import SFPLogger, { COLOR_ERROR, COLOR_KEY_VALUE } from '@dxatscale/sfp-logger/lib/SFPLogger';
import inquirer = require('inquirer');
import OrgDelete from '../../impl/sfdxwrappers/OrgDelete';
import { SfpProjectConfig } from '../../types/SfpProjectConfig';
import PickAnOrgWorkflow from './PickAnOrgWorkflow';
import cli from 'cli-ux';

export default class DeleteOrgWorkflow {
    public constructor(private sfpProjectConfig: SfpProjectConfig, private username?: string) {}

    public async execute() {
        if (this.username == null) {
            let pickAnOrg = new PickAnOrgWorkflow();
            this.username = await pickAnOrg.getADevOrg();
        }

        let isDeleteOrgConfirmation = await this.confirmDeletionOfOrg(this.username);
        if (isDeleteOrgConfirmation) {
            cli.action.start(`  Deleting org ${this.username}..`);
            try {
                let command = new OrgDelete(this.username, this.sfpProjectConfig.defaultDevHub);
                await command.exec();
            } catch (error) {
                SFPLogger.log(
                    `${COLOR_ERROR(
                        `Unable to delete this dev org, You may need to delete this from ${this.sfpProjectConfig.repoProvider} pipelines`
                    )}`
                );
            }
        }
        cli.action.stop();
    }

    private async confirmDeletionOfOrg(username: string) {
        let confirmation = await inquirer.prompt({
            type: 'confirm',
            name: 'result',
            message: `Do you want to delete the org ${COLOR_KEY_VALUE(username)}, Proceed?`,
            default: true,
        });
        return confirmation.result;
    }
}
