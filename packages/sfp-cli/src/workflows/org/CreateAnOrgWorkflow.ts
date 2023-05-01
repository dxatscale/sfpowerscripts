import ScratchOrg from '@dxatscale/sfpowerscripts.core/lib/scratchorg/ScratchOrg';
import { Org } from '@salesforce/core';
import inquirer = require('inquirer');
import PoolListImpl from '@dxatscale/sfpowerscripts.core/lib/scratchorg/pool/PoolListImpl';
import { SfpProjectConfig } from '../../types/SfpProjectConfig';
import { isEmpty } from 'lodash';
import cli from 'cli-ux';
import SFPLogger, {
    COLOR_KEY_MESSAGE,
    COLOR_SUCCESS,
    LoggerLevel,
} from '@dxatscale/sfp-logger/lib/SFPLogger';
import InstalledArtifactsDisplayer from '@dxatscale/sfpowerscripts.core/lib/display/InstalledArtifactsDisplayer';
import InstalledPackageDisplayer from '@dxatscale/sfpowerscripts.core/lib/display/InstalledPackagesDisplayer';
import PoolFetchImpl from '@dxatscale/sfpowerscripts.core/lib/scratchorg/pool/PoolFetchImpl';
import OrgOpen from '../../impl/sfdxwrappers/OrgOpen';
import InstallDependenciesWorkflow from '../package/InstallDependenciesWorkflow';
import ScratchOrgOperator from '@dxatscale/sfpowerscripts.core/lib/scratchorg/ScratchOrgOperator';
import SFPOrg from '@dxatscale/sfpowerscripts.core/lib/org/SFPOrg';

export default class CreateAnOrgWorkflow {
    private isOrgCreated = false;
    private isOrgFetched = false;

    constructor(private sfpProjectConfig: SfpProjectConfig, private alias?: string) {}

    public async execute(): Promise<string> {
        let devHubUserName = this.sfpProjectConfig.defaultDevHub;

        let createdOrg;
        let type = await this.promptForOrgTypeSelection();

        if (type === OrgType.POOL) {
            // Now Fetch All Pools in that devhub
            const hubOrg = await Org.create({ aliasOrUsername: devHubUserName });
            let scratchOrgsInDevHub = await new PoolListImpl(hubOrg, null, true).execute() as ScratchOrg[];

            let tags = this.getPoolTags(scratchOrgsInDevHub);

            if (!isEmpty(tags)) {
                let selectedTag = await this.promptForPoolSelection(tags, this.sfpProjectConfig.defaultPool);
                cli.action.start(` Fetching a scratchorg from ${selectedTag} pool `);
                let fetchedOrg = await this.fetchOrg(hubOrg, selectedTag, this.alias);

                createdOrg = fetchedOrg.username;
                this.isOrgFetched = true;
                cli.action.stop();
                await this.displayOrgContents(fetchedOrg);

                SFPLogger.log(COLOR_SUCCESS(`Sucesfully fetched a new dev environment with alias ${this.alias}`));
            } else {
                let isDevEnvironmentCreationRequested = await this.promptForCreatingDevEnvironmentIfPoolEmpty();
                if (isDevEnvironmentCreationRequested) {
                    createdOrg = await this.createOrg(this.alias, this.sfpProjectConfig, OrgType.SCRATCHORG);
                }
                this.isOrgCreated = true;
            }
        } else if (type === OrgType.SCRATCHORG) {
            let isDevEnvironmentCreationRequested = await this.promptForCreatingScratchOrg();
            if (isDevEnvironmentCreationRequested) {
                createdOrg = await this.createOrg(this.alias, this.sfpProjectConfig, OrgType.SCRATCHORG);
                this.isOrgCreated = true;
            }
        } else {
            let isDevEnvironmentCreationRequested = await this.promptForCreatingSandbox();
            if (isDevEnvironmentCreationRequested) {
                createdOrg = await this.createOrg(this.alias, this.sfpProjectConfig, OrgType.SANDBOX);
                this.isOrgCreated = true;
            }
        }

        if (createdOrg) {
            if (this.isOrgCreated) await this.installDependencies(createdOrg, true);
            else await this.installDependencies(createdOrg, false);

            let isOrgToBeOpened = await this.promptForNeedForOpeningDevEnvironment();
            if (isOrgToBeOpened) {
                let command = new OrgOpen(createdOrg);
                await command.exec(false);
            }
        }

        return createdOrg;
    }

    private async createOrg(id: string, sfpProjectConfig: SfpProjectConfig, type: OrgType): Promise<string> {
        switch (type) {
            case OrgType.SCRATCHORG:
                cli.action.start(` Creating A ScratchOrg with duration set to 10 days..`);
                let hubOrg = await Org.create({ aliasOrUsername: sfpProjectConfig.defaultDevHub });
                let scratchOrgOperator: ScratchOrgOperator = new ScratchOrgOperator(hubOrg);
                let result = await scratchOrgOperator.create(id, 'config/project-scratch-def.json', 10);
                cli.action.stop();
                SFPLogger.log(COLOR_KEY_MESSAGE(`  Successfully created a scratchorg for WorkItem ${id}`));
                return result.username;
            case OrgType.SANDBOX:
                SFPLogger.log(COLOR_KEY_MESSAGE(`  Coming soon`));
                throw new Error('Not implemented, Please choose another option and try again');
        }
    }

    private async fetchOrg(hubOrg: Org, pool: string, alias: string): Promise<ScratchOrg> {
        let poolFetchImpl = new PoolFetchImpl(hubOrg, pool, false, false, null, alias, true);
        poolFetchImpl.setSourceTrackingOnFetch();
        return poolFetchImpl.execute() as ScratchOrg;
    }

    private getPoolTags(result: ScratchOrg[]) {
        let availableSo = [];
        if (result.length > 0) {
            availableSo = result.filter((soInfo) => soInfo.status === 'Available');
        }

        let tagCounts: any = availableSo.reduce(function (obj, v) {
            obj[v.tag] = (obj[v.tag] || 0) + 1;
            return obj;
        }, {});

        let tagArray = new Array<any>();

        Object.keys(tagCounts).forEach(function (key) {
            if (tagCounts[key] >= 1)
                tagArray.push({
                    name: key,
                    value: key,
                });
        });

        return tagArray;
    }

    private async promptForNeedForOpeningDevEnvironment(): Promise<boolean> {
        const isDevEnvironmentRequiredPrompt = await inquirer.prompt([
            {
                type: 'confirm',
                name: 'isOrgToBeOpened',
                message: 'Do you want to open the org in a web browser?',
                default: true,
            },
        ]);
        return isDevEnvironmentRequiredPrompt.isOrgToBeOpened;
    }

    private async promptForCreatingDevEnvironmentIfPoolEmpty(): Promise<boolean> {
        const isCreateDevEnvironmentRequiredPrompt = await inquirer.prompt([
            {
                type: 'confirm',
                name: 'create',
                message:
                    'No scratch orgs available in pool, Create a new scratch org (This would take a considerable time)?',
            },
        ]);
        return isCreateDevEnvironmentRequiredPrompt.create;
    }

    private async displayOrgContents(scratchOrg: ScratchOrg) {
        try {
            const scratchOrgAsSFPOrg = await SFPOrg.create({ aliasOrUsername: scratchOrg.username });

            let installedManagedPackages = await scratchOrgAsSFPOrg.getAllInstalledManagedPackages();
            SFPLogger.log('Installed managed packages:', LoggerLevel.INFO);
            InstalledPackageDisplayer.printInstalledPackages(installedManagedPackages, null);

            let installedArtifacts = await scratchOrgAsSFPOrg.getInstalledArtifacts();
            InstalledArtifactsDisplayer.printInstalledArtifacts(installedArtifacts, null);
        } catch (error) {
            SFPLogger.log('Failed to query packages/artifacts installed in the org', LoggerLevel.ERROR);
        }
    }

    private async installDependencies(username: string, isUpdateMode: boolean) {
        try {
            let installDependenciesWorkflow = new InstallDependenciesWorkflow(
                this.sfpProjectConfig,
                username,
                isUpdateMode
            );
            await installDependenciesWorkflow.execute();
        } catch (error) {
            SFPLogger.log(error.message, LoggerLevel.ERROR);
            if (this.isOrgCreated)
                SFPLogger.log(
                    'Unable to install external dependency packages, Check your sfdx-project.json ',
                    LoggerLevel.ERROR
                );
            else
                SFPLogger.log(
                    'Unable to update external dependency packages, Check your sfdx-project.json ',
                    LoggerLevel.ERROR
                );
        }
    }

    private async promptForPoolSelection(pools: Array<any>, defaultPool: string): Promise<string> {
        const pool = await inquirer.prompt([
            {
                type: 'list',
                name: 'tag',
                message: 'Select a Scratch Org Pool (Only pools with alteast 1 org is displayed)',
                choices: pools,
                default: { name: defaultPool, value: defaultPool },
            },
        ]);
        return pool.tag;
    }

    private async promptForCreatingScratchOrg(): Promise<boolean> {
        const isCreateScratchOrg = await inquirer.prompt([
            {
                type: 'confirm',
                name: 'create',
                message: 'Create a new scratch org (This would take a considerable time)?',
            },
        ]);
        return isCreateScratchOrg.create;
    }

    private async promptForCreatingSandbox(): Promise<boolean> {
        const isCreateSandbox = await inquirer.prompt([
            {
                type: 'confirm',
                name: 'create',
                message: 'Create a new sandbox (This would take a considerable time)?',
            },
        ]);
        return isCreateSandbox.create;
    }

    private async promptForOrgTypeSelection(): Promise<OrgType> {
        const orgType = await inquirer.prompt([
            {
                type: 'list',
                name: 'type',
                message: 'Select a type of dev environment',
                choices: [
                    { name: 'Fetch a scratchorg from pool', value: OrgType.POOL },
                    { name: 'Create a scratchorg', value: OrgType.SCRATCHORG },
                    { name: 'Create a dev sandbox', value: OrgType.SANDBOX },
                ],
            },
        ]);
        return orgType.type;
    }
}
enum OrgType {
    POOL = 1,
    SCRATCHORG = 2,
    SANDBOX = 3,
}
