import OrgList from '../../impl/sfdxwrappers/OrgList';
import { isEmpty } from 'lodash';
import inquirer = require('inquirer');
import cli from 'cli-ux';
import { convertAliasToUsername } from '@dxatscale/sfpowerscripts.core/lib/utils/AliasList';

export default class PickAnOrgWorkflow {
    private orgList: any;

    constructor(private defaultOrg?: { username?: string; alias?: string }) {}

    private async getListofAuthenticatedOrgs() {
        let orgList: OrgList = new OrgList();
        return orgList.exec(true);
    }

    private getListOfAuthenticatedLocalDevHubs(): Array<{ name: string; alias: string; value: string }> {
        if (!isEmpty(this.orgList.nonScratchOrgs)) {
            let devHubOrgs = this.orgList.nonScratchOrgs.filter((orgs) => orgs.isDevHub === true);
            let devhubUserList = new Array<{ name: string; alias: string; value: string }>();
            devHubOrgs.map((element) => {
                devhubUserList.push({
                    name: `${element.username} - ${element.alias}`,
                    alias: element.alias,
                    value: element.username,
                });
            });
            return devhubUserList;
        } else {
            throw new Error('Unable to find any devhubs');
        }
    }

    private getListOfDevOrgs(): Array<{ name: string; alias: string; value: string }> {
        if (!isEmpty(this.orgList.scratchOrgs)) {
            let devOrgList = new Array<{ name: string; alias: string; value: string }>();
            this.orgList.scratchOrgs.map((element) => {
                devOrgList.push({
                    name: `${element.username} - ${element.alias}`,
                    alias: element.alias,
                    value: element.username,
                });
            });

            let sandboxes = this.orgList.nonScratchOrgs.filter((orgs) => orgs.isDevHub === false);
            sandboxes.map((element) => {
                devOrgList.push({
                    name: `${element.username} - ${element.alias}`,
                    alias: element.alias,
                    value: element.username,
                });
            });

            return devOrgList;
        } else {
            throw new Error('Unable to find any dev orgs');
        }
    }

    private getListOfAllOrgs(): Array<{ name: string; alias: string; value: string }> {
        let orgList = new Array<{ name: string; alias: string; value: string }>();
        this.orgList.scratchOrgs.map((element) => {
            orgList.push({
                name: `${element.username} - ${element.alias}`,
                alias: element.alias,
                value: element.username,
            });
        });

        let nonScratchOrgs = this.orgList.nonScratchOrgs;

        nonScratchOrgs.map((element) => {
            orgList.push({
                name: `${element.username} - ${element.alias}`,
                alias: element.alias,
                value: element.username,
            });
        });
        return orgList;
    }

    public async getADevHub(): Promise<string> {
        await this.fetchOrgs();

        if ((this.defaultOrg?.username == null || this.defaultOrg?.username == undefined) && this.defaultOrg?.alias) {
            this.defaultOrg.username = await convertAliasToUsername(this.defaultOrg.alias);
        }

        let devHubOrgUserNameList = this.getListOfAuthenticatedLocalDevHubs();
        let defaultChoiceIndex = devHubOrgUserNameList.findIndex(
            (element) => element.alias == this.defaultOrg?.alias || element.value == this.defaultOrg?.username
        );
        const devhub = await inquirer.prompt([
            {
                type: 'list',
                name: 'username',
                message: 'Pick a DevHub',
                choices: devHubOrgUserNameList,
                default: defaultChoiceIndex,
            },
        ]);

        return devhub.username;
    }

    public async getADevOrg(): Promise<string> {
        if ((this.defaultOrg?.username == null || this.defaultOrg?.username == undefined) && this.defaultOrg?.alias) {
            this.defaultOrg.username = await convertAliasToUsername(this.defaultOrg.alias);
        }

        await this.fetchOrgs();

        let devOrgList = this.getListOfDevOrgs();
        let defaultChoiceIndex = devOrgList.findIndex(
            (element) => element.alias == this.defaultOrg?.alias || element.value == this.defaultOrg?.username
        );

        const devOrg = await inquirer.prompt([
            {
                type: 'list',
                name: 'username',
                message: 'Pick a Dev Org',
                choices: devOrgList,
                default: defaultChoiceIndex,
            },
        ]);

        return devOrg.username;
    }

    public async getAnyOrg(): Promise<string> {
        await this.fetchOrgs();

        let allOrgList = this.getListOfAllOrgs();

        const devOrg = await inquirer.prompt([
            {
                type: 'list',
                name: 'username',
                message: 'Pick a  Org',
                choices: allOrgList,
            },
        ]);

        return devOrg.username;
    }

    private async fetchOrgs() {
        cli.action.start(`  Fetching Orgs...`);
        if (!this.orgList) this.orgList = await this.getListofAuthenticatedOrgs();

        cli.action.stop();
    }
}
