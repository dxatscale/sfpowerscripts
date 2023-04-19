import * as fs from 'fs-extra';
import inquirer = require('inquirer');
import SFPlogger, {
    COLOR_HEADER,
    COLOR_KEY_MESSAGE,
    COLOR_WARNING,
} from '@dxatscale/sfp-logger/lib/SFPLogger';
import cli from 'cli-ux';
import simpleGit, { SimpleGit } from 'simple-git';
import path = require('path');
import { WorkItem } from '../../types/WorkItem';
import { SfpProjectConfig } from '../../types/SfpProjectConfig';
import CreateAnOrgWorkflow from '../org/CreateAnOrgWorkflow';
import SFPLogger from '@dxatscale/sfp-logger/lib/SFPLogger';

export default class NewWorkItemWorkflow {
    orgList: any;
    workItem: WorkItem;

    public constructor(private sfpProjectConfig: SfpProjectConfig, private configDir: string) {}

    async execute() {
        SFPlogger.log(COLOR_KEY_MESSAGE('Provide details of the workitem'));

        let workItemId = await this.promptAndCaptureWorkItem();
        this.workItem = new WorkItem(workItemId);

        this.workItem = new WorkItem(workItemId);
        //Check config whether workItem is available
        if (this.sfpProjectConfig.workItems && this.sfpProjectConfig.workItems[this.workItem.id]) {
            SFPlogger.log(COLOR_WARNING('Workitem already exists.. Switching to workItem'));
            //Get existing workItem detail
            this.workItem = this.sfpProjectConfig.workItems[this.workItem.id];
        } else {
            //Get Type
            this.workItem.type = await this.promptForWorkItemType();

            //Get  Tracking branch
            this.workItem.trackingBranch = await this.promptAndCaptureTrackingBranch(
                this.sfpProjectConfig.defaultBranch
            );
        }

        let branchName = `${this.workItem.type}/${this.workItem.id.toUpperCase()}`;

        //Switch Git
        cli.action.start(` Sync Git Repository...`);
        const git: SimpleGit = simpleGit();
        await git.fetch('origin');
        cli.action.stop();

        //Get Branch choices
        let branchChoices = await this.getBranchChoice(git, branchName);

        //Create or switch branch
        if (branchChoices[0].value === 'create') {
            await git.checkoutBranch(branchName, `remotes/origin/${this.sfpProjectConfig.defaultBranch}`);
            SFPLogger.log(
                COLOR_KEY_MESSAGE(
                    ` Created new branch ${COLOR_HEADER(branchName)} from ${COLOR_HEADER(
                        `origin/${this.sfpProjectConfig.defaultBranch}`
                    )}`
                )
            );
            this.workItem.branch = branchName;

            SFPLogger.log(` Creating remote branch origin/${branchName}`);
            await git.push('origin', branchName);
        } else if (branchChoices[0].value === 'switch') {
            await git.checkout(branchName);
            SFPLogger.log(COLOR_KEY_MESSAGE(`Switched to existing branch ${branchName}`));
        } else {
            let option = await this.promptForBranchSelection(branchChoices);
            if (option === 'switch') {
                await git.checkout(branchName);
                SFPLogger.log(COLOR_KEY_MESSAGE(` Switched to existing branch ${COLOR_HEADER(branchName)}`));
            } else if (option === 'new') {
                await git.deleteLocalBranch(branchName);
                SFPLogger.log(COLOR_KEY_MESSAGE(` Deleted existing local branch ${COLOR_HEADER(branchName)}`));
                await git.checkoutBranch(branchName, `remotes/origin/${this.sfpProjectConfig.defaultBranch}`);
                SFPLogger.log(
                    COLOR_KEY_MESSAGE(
                        ` Created new branch ${COLOR_HEADER(branchName)} from ${COLOR_HEADER(
                            `origin/${this.sfpProjectConfig.defaultBranch}`
                        )}`
                    )
                );
            }
        }

        //Assign Dev Environment in both cases
        let isDevEnvironmentRequired = await this.promptForNeedForDevEnvironment();
        if (isDevEnvironmentRequired) {
            try {
                let createAnOrg: CreateAnOrgWorkflow = new CreateAnOrgWorkflow(this.sfpProjectConfig, this.workItem.id);
                this.workItem.defaultDevOrg = await createAnOrg.execute();
            } catch (error) {
                //Unable to create org
                SFPlogger.log(COLOR_WARNING('Unable to create/fetch org, please use sfp org to allocate an org later'));
            }
        }

        if (this.sfpProjectConfig.workItems == null) {
            this.sfpProjectConfig.workItems = {};
        } else {
            this.disableExistingWorkItems();
        }

        //Commit back
        this.sfpProjectConfig.workItems[this.workItem.id] = this.workItem;
        this.sfpProjectConfig.workItems[this.workItem.id].isActive = true;

        fs.writeJSONSync(path.join(this.configDir, `${this.sfpProjectConfig.name}.json`), this.sfpProjectConfig);
    }

    private async getBranchChoice(git: SimpleGit, branchName: String): Promise<{ name: string; value: string }[]> {
        let branchChoices: any;
        let branches = await git.branch();
        let isLocalBranchAvailable: boolean = false;
        let isRemoteBranchAvailable: boolean = false;

        if (branches.all.find((branch) => branch.toLowerCase() === branchName.toLowerCase())) {
            isLocalBranchAvailable = true;
        }
        if (branches.all.find((branch) => branch.toLowerCase() === `remotes/origin/${branchName}`.toLowerCase())) {
            isRemoteBranchAvailable = true;
        }

        if (isLocalBranchAvailable && !isRemoteBranchAvailable) {
            branchChoices = [
                { name: 'Switch to the existing branch', value: 'switch' },
                {
                    name: 'Delete & Create a new local branch (destructive)',
                    value: 'new',
                },
            ];
        } else if (!isLocalBranchAvailable && isRemoteBranchAvailable) {
            branchChoices = [{ name: 'Switch to the existing branch', value: 'switch' }];
        } else if (isLocalBranchAvailable && isRemoteBranchAvailable) {
            branchChoices = [{ name: 'Switch to the existing branch', value: 'switch' }];
        } else {
            branchChoices = [{ name: 'Create new branch', value: 'create' }];
        }
        return branchChoices;
    }

    private async promptAndCaptureWorkItem(): Promise<string> {
        const workItem = await inquirer.prompt([
            {
                type: 'input',
                name: 'id',
                message: 'Input Id for the Work Item',
                validate: this.validateInput,
            },
        ]);

        return workItem.id;
    }

    private async promptAndCaptureTrackingBranch(defaultBranch: string): Promise<string> {
        const branchPrompt = await inquirer.prompt([
            {
                type: 'input',
                name: 'branch',
                message: 'What branch should this workitem track?',
                default: defaultBranch,
            },
        ]);
        return branchPrompt.branch;
    }

    private async promptForWorkItemType(): Promise<string> {
        const workItemTypePrompt = await inquirer.prompt([
            {
                type: 'list',
                name: 'type',
                message: 'Select the type of work item that you are building:',
                choices: [
                    { name: 'feat: A new feature', value: 'feature' },
                    { name: 'fix:  A bugfix', value: 'bugfix' },
                    {
                        name: 'chore:  changes to scripts/test/readme etc.',
                        value: 'chore',
                    },
                    {
                        name: 'refactor:  A code change that neither fixes a bug or adds a feature',
                        value: 'refactor',
                    },
                ],
            },
        ]);

        return workItemTypePrompt.type;
    }

    private async promptForNeedForDevEnvironment(): Promise<boolean> {
        const isDevEnvironmentRequiredPrompt = await inquirer.prompt([
            {
                type: 'confirm',
                name: 'isDevEnvironmentRequired',
                message: 'Do you need a new dev environment?',
                default: true,
            },
        ]);
        return isDevEnvironmentRequiredPrompt.isDevEnvironmentRequired;
    }

    private async promptForBranchSelection(branchChoices): Promise<string> {
        const branchResolution = await inquirer.prompt([
            {
                type: 'list',
                name: 'option',
                message: 'A branch with the name already exists, Please select from the following resolution',
                choices: branchChoices,
                default: { name: 'Delete & Create a new local branch', value: 'new' },
            },
        ]);
        return branchResolution.option;
    }

    private async validateInput(answers, input) {
        if (answers.length >= 4) return true;
        else return 'Please enter a valid issue number with a minimum of 4 characters such as APR-1 or issue-1 etc';
    }

    private disableExistingWorkItems() {
        for (const [key] of Object.entries(this.sfpProjectConfig.workItems)) {
            this.sfpProjectConfig.workItems[key].isActive = false;
        }
    }
}
