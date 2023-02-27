import { flags } from '@oclif/command';
import inquirer = require('inquirer');
import {
    COLOR_ERROR,
    COLOR_KEY_MESSAGE,
    COLOR_SUCCESS,
    COLOR_WARNING,
} from '@dxatscale/sfp-logger/lib/SFPLogger';
import OrgAuth from '../impl/sfdxwrappers/OrgAuth';
import PickAnOrgWorkflow from '../workflows/org/PickAnOrgWorkflow';
import PoolListImpl from '@dxatscale/sfpowerscripts.core/lib/scratchorg/pool/PoolListImpl';
import { isEmpty } from 'lodash';
import ScratchOrg from '@dxatscale/sfpowerscripts.core/lib/scratchorg/ScratchOrg';
import SfpCommand from '../SfpCommand';
import * as fs from 'fs-extra';
import { Org } from '@salesforce/core';
import path = require('path');
import RepoProviderSelector from '../impl/repoprovider/RepoProviderSelector';
import SFPLogger from '@dxatscale/sfp-logger/lib/SFPLogger';

export default class Init extends SfpCommand {
    static description = 'intializes the project with various defaults';

    static flags = {
        help: flags.help({ char: 'h' }),
    };

    static args = [{ name: 'caller' }, { name: 'mode' }];

    async exec() {
        //TODO: check for DX@Scale project

        this.sfpProjectConfig.defaultBranch = await this.promptForDefaultBranch();
        let isDevHubRequired = await this.promptForNeedForDevHub();

        let isNewDevHubAuthRequired: boolean = false;

        if (isDevHubRequired) {
            isNewDevHubAuthRequired = await this.promptForNeedForDevHubAuth();

            if (isNewDevHubAuthRequired) {
                let instanceURL = await this.promptForInstanceURL();
                try {
                    let orgAuth = new OrgAuth(instanceURL);
                    await orgAuth.exec(false);
                } catch (error) {
                    SFPLogger.log(
                        COLOR_ERROR(`Unable to authenticate to the org, Please try agin later or fix the error below`)
                    );
                    throw error;
                }
            }
            let devHubUserName = await new PickAnOrgWorkflow({
                username: this.sfpProjectConfig.defaultDevHub,
            }).getADevHub();

            const hubOrg = await Org.create({ aliasOrUsername: devHubUserName });
            this.sfpProjectConfig.defaultDevHub = devHubUserName;

            //Select Default Scratch Org Pool
            let scratchOrgsInDevHub  = await new PoolListImpl(hubOrg, null, true).execute() as ScratchOrg[];

            let tags = this.getPoolTags(scratchOrgsInDevHub);

            let selectedTag;
            if (!isEmpty(tags)) {
                selectedTag = await this.promptForPoolSelection(tags);
                this.sfpProjectConfig.defaultPool = selectedTag;
            }
        }

        this.sfpProjectConfig.repoProvider = await this.promptForRepoProvider();
        if (this.sfpProjectConfig.repoProvider != 'other') {
            let repoProvider = RepoProviderSelector.getRepoProvider(this.sfpProjectConfig.repoProvider);
            let isCLIInstalled = await repoProvider.isCLIInstalled();
            if (isCLIInstalled) {
                await repoProvider.authenticate();
            } else {
                SFPLogger.log(COLOR_WARNING(` Missing ${this.sfpProjectConfig.repoProvider} CLI`));
                SFPLogger.log(
                    COLOR_KEY_MESSAGE(
                        ` Installing ${this.sfpProjectConfig.repoProvider} CLI allows you to automate further. \nPlease read the instructions below`
                    )
                );

                SFPLogger.log(repoProvider.getInstallationMessage(this.config.platform));
            }
        }

        //TODO: Check for existence of SFDX and Plugins

        fs.mkdirpSync(this.config.configDir);

        this.sfpProjectConfig.name = this.projectName;

        fs.writeFileSync(
            path.join(this.config.configDir, `${this.projectName}.json`),
            JSON.stringify(this.sfpProjectConfig)
        );

        SFPLogger.log(COLOR_SUCCESS(`Project ${this.projectName} succesfully intiialized`));
    }

    private async promptForPoolSelection(pools: Array<string>): Promise<string> {
        const pool = await inquirer.prompt([
            {
                type: 'list',
                name: 'tag',
                message: 'Select a Default Scratch Org Pool',
                choices: pools,
                default: this.sfpProjectConfig.defaultPool,
            },
        ]);
        return pool.tag;
    }

    private getPoolTags(result: ScratchOrg[]): string[] {
        let tagCounts: any = result.reduce(function (obj, v) {
            obj[v.tag] = (obj[v.tag] || 0) + 1;
            return obj;
        }, {});

        let tagArray = new Array<string>();

        Object.keys(tagCounts).forEach(function (key) {
            if (tagCounts[key] >= 1) tagArray.push(key);
        });

        return tagArray;
    }

    private async promptForNeedForDevHub(): Promise<boolean> {
        const isDevHubAuthRequiredPrompt = await inquirer.prompt([
            {
                type: 'confirm',
                name: 'isDevHubRequired',
                message: 'Associate a devhub with this project?',
                default: false,
            },
        ]);
        return isDevHubAuthRequiredPrompt.isDevHubRequired;
    }

    private async promptForNeedForDevHubAuth(): Promise<boolean> {
        const isDevHubAuthRequiredPrompt = await inquirer.prompt([
            {
                type: 'confirm',
                name: 'isDevHubAuthRequired',
                message: 'Need to authenticate to new DevHub?',
                default: false,
            },
        ]);
        return isDevHubAuthRequiredPrompt.isDevHubAuthRequired;
    }

    private async promptForInstanceURL(): Promise<string> {
        const instanceURLPrompt = await inquirer.prompt([
            {
                type: 'input',
                name: 'instanceURL',
                message:
                    'Instance URL of the org, in format MyDomainName.my.salesforce.com or leave blank to use login.salesforce.com',
            },
        ]);

        return instanceURLPrompt.instanceURL;
    }

    private async promptForDefaultBranch(): Promise<string> {
        const defaultBranchPrompt = await inquirer.prompt([
            {
                type: 'input',
                name: 'branch',
                message: 'Default git branch for this repo',
                default: this.sfpProjectConfig?.defaultBranch ? this.sfpProjectConfig?.defaultBranch : 'main',
            },
        ]);

        return defaultBranchPrompt.branch;
    }

    private async promptForRepoProvider(): Promise<string> {
        const repoProviderPrompt = await inquirer.prompt([
            {
                type: 'list',
                name: 'repoprovider',
                message: 'Select a repository provider for this project',
                choices: ['github', 'azure repo', 'gitlab', 'other'],
                default: 'github',
            },
        ]);

        return repoProviderPrompt.repoprovider;
    }
}
