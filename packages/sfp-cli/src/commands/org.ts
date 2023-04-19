import SFPLogger, { COLOR_ERROR } from '@dxatscale/sfp-logger/lib/SFPLogger';
import { flags } from '@oclif/command';
import inquirer = require('inquirer');
import simpleGit, { SimpleGit } from 'simple-git';
import OrgOpen from '../impl/sfdxwrappers/OrgOpen';
import CreateAnOrgWorkflow from '../workflows/org/CreateAnOrgWorkflow';
import PickAnOrgWorkflow from '../workflows/org/PickAnOrgWorkflow';
import CommandsWithInitCheck from '../sharedCommandBase/CommandsWithInitCheck';
import { WorkItem } from '../types/WorkItem';
import NewWorkItemWorkflow from '../workflows/workitems/NewWorkItemWorkflow';
import * as fs from 'fs-extra';
import path = require('path');
import DeleteOrgWorkflow from '../workflows/org/DeleteOrgWorkflow';

export default class Org extends CommandsWithInitCheck {
    static description = 'guided workflows to help with developer orgs';
    private workItem: WorkItem;
    private workItemId: string;

    static flags = {
        help: flags.help({ char: 'h' }),
    };

    protected async executeCommand(): Promise<any> {
        let orgCommandSelected;

        const git: SimpleGit = simpleGit();
        let branches = await git.branch();
        this.workItem = this.sfpProjectConfig.getWorkItemGivenBranch(branches.current);

        orgCommandSelected = await this.promptForOrgCommandSelection();

        if (orgCommandSelected === OrgCommand.OPEN_ORG_WORKITEM) {
            if (this.workItem?.id == null) {
                SFPLogger.log(COLOR_ERROR(`  No work item or org associated with the branch. Create a work item`));
                let newWorkItemWorkflow: NewWorkItemWorkflow = new NewWorkItemWorkflow(
                    this.sfpProjectConfig,
                    this.config.configDir
                );
                await newWorkItemWorkflow.execute();
            } else await this.openAssociatedOrg(this.workItem.defaultDevOrg);
        } else if (orgCommandSelected === OrgCommand.OPEN_ANY_ORG) {
            await this.openAnyOrg();
        } else if (orgCommandSelected === OrgCommand.CREATE_AN_ORG) {
            await this.associateANewDevOrg();
        } else {
            let deleteOrgWorkflow = new DeleteOrgWorkflow(this.sfpProjectConfig);
            await deleteOrgWorkflow.execute();
        }
    }

    private async openAssociatedOrg(username: string) {
        try {
            let command = new OrgOpen(username);
            await command.exec(false);
        } catch (error) {
            SFPLogger.log(COLOR_ERROR('  Associated org with this branch/workItem is missing'));
            await this.associateANewDevOrg();
        }
    }

    private async associateANewDevOrg() {
        if (this.workItem?.id) {
            let createAnOrg: CreateAnOrgWorkflow = new CreateAnOrgWorkflow(this.sfpProjectConfig, this.workItem.id);
            this.workItem.defaultDevOrg = await createAnOrg.execute();
            let isAssociate = await this.promptForAssociation();
            if (isAssociate) {
                //Commit back
                this.sfpProjectConfig.workItems[this.workItem.id] = this.workItem;
                this.sfpProjectConfig.workItems[this.workItem.id].isActive = true;

                fs.writeJSONSync(path.join(this.config.configDir, `${this.projectName}.json`), this.sfpProjectConfig);
            }
        } else {
            let createAnOrg: CreateAnOrgWorkflow = new CreateAnOrgWorkflow(this.sfpProjectConfig, this.workItemId);
            await createAnOrg.execute();
        }
    }

    private async promptForAssociation(): Promise<boolean> {
        const associatePrompt = await inquirer.prompt([
            {
                type: 'confirm',
                name: 'isAssociate',
                message: 'Do you need to associate this dev environment with workItem?',
                default: false,
            },
        ]);
        return associatePrompt.isAssociate;
    }

    private async openAnyOrg() {
        let pickAnOrg = new PickAnOrgWorkflow();
        let username = await pickAnOrg.getAnyOrg();
        let command = new OrgOpen(username);
        await command.exec();
    }

    private async promptForOrgCommandSelection(): Promise<OrgCommand> {
        const orgType = await inquirer.prompt([
            {
                type: 'list',
                name: 'type',
                message: 'Select an operation',
                choices: [
                    { name: 'Open associated org', value: OrgCommand.OPEN_ORG_WORKITEM },
                    {
                        name: 'Open any authenticated org',
                        value: OrgCommand.OPEN_ANY_ORG,
                    },
                    { name: 'Create an org', value: OrgCommand.CREATE_AN_ORG },
                    { name: 'Delete an org', value: OrgCommand.DELETE_AN_ORG },
                ],
            },
        ]);
        return orgType.type;
    }
}

enum OrgCommand {
    OPEN_ORG_WORKITEM = 1,
    OPEN_ANY_ORG = 2,
    CREATE_AN_ORG = 3,
    DELETE_AN_ORG = 4,
}
