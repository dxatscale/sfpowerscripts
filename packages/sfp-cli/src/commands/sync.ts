import { flags } from '@oclif/command';
import inquirer = require('inquirer');
import SFPLogger, { COLOR_KEY_MESSAGE, COLOR_WARNING } from '@dxatscale/sfp-logger/lib/SFPLogger';
import CommandsWithInitCheck from '../sharedCommandBase/CommandsWithInitCheck';
import simpleGit from 'simple-git';
import PickAnOrgWorkflow from '../workflows/org/PickAnOrgWorkflow';
import SyncGit from '../workflows/sync/SyncGit';
import SyncOrg from '../workflows/sync/SyncOrg';
import PushSourceToOrg from '../impl/sfpcommands/PushSourceToOrg';

export default class Sync extends CommandsWithInitCheck {
    static description = 'sync changes effortlessly either with repository or development environment';

    static flags = {
        help: flags.help({ char: 'h' }),
    };

    async executeCommand() {
        let option = await this.promptAndCaptureOption();

        const git = simpleGit();
        if (option === 'sync-git') {
            await new SyncGit(git, this.sfpProjectConfig).execute();
        } else if (option === 'sync-org') {
            const branches = await git.branch();
            const workItem = this.sfpProjectConfig.getWorkItemGivenBranch(branches.current);

            //Only select org if there is no org available
            let devOrg: string;
            if (workItem?.defaultDevOrg == null) {
                SFPLogger.log(
                    `  ${COLOR_WARNING(
                        `Work Item not intialized, always utilize ${COLOR_KEY_MESSAGE(`sfp work`)} to intialize work`
                    )}`
                );
                devOrg = await new PickAnOrgWorkflow().getADevOrg();
                //Reset source tracking when user picks up random orgs
                //await new SourceTrackingReset(devOrg).exec(true);
            } else {
                devOrg = workItem.defaultDevOrg;
            }

            await new SyncOrg(git, this.sfpProjectConfig, devOrg).execute();
        } else if(option == 'sync-org-force')
        {
            const branches = await git.branch();
            const workItem = this.sfpProjectConfig.getWorkItemGivenBranch(branches.current);

            //Only select org if there is no org available
            let devOrg: string;
            if (workItem?.defaultDevOrg == null) {
                SFPLogger.log(
                    `  ${COLOR_WARNING(
                        `Work Item not intialized, always utilize ${COLOR_KEY_MESSAGE(`sfp work`)} to intialize work`
                    )}`
                );
                devOrg = await new PickAnOrgWorkflow().getADevOrg();
                //Reset source tracking when user picks up random orgs
                //await new SourceTrackingReset(devOrg).exec(true);
            } else {
                devOrg = workItem.defaultDevOrg;
            }


            await new PushSourceToOrg(devOrg).exec();
        }
    }

    private async promptAndCaptureOption(): Promise<string> {
        const optionPrompt = await inquirer.prompt([
            {
                type: 'list',
                name: 'option',
                message: 'Select an option to proceed?',
                choices: [
                    { name: 'Sync local with remote repository', value: 'sync-git' },
                    { name: 'Sync local with Dev Org', value: 'sync-org' },
                    { name: 'Force Push to Dev Org', value: 'sync-org-force' },
                ],
                default: 'Sync local with remote repository',
            },
        ]);

        return optionPrompt.option;
    }
}
