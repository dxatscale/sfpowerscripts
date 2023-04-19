import { SimpleGit } from 'simple-git';
import { SfpProjectConfig } from '../../types/SfpProjectConfig';
import SFPLogger, { LoggerLevel, COLOR_KEY_MESSAGE } from '@dxatscale/sfp-logger/lib/SFPLogger';
import SourceStatusWorkflow from '../source/SourceStatusWorkflow';
import inquirer = require('inquirer');
import PullSourceWorkflow from '../source/PullSourceWorkflow';
import CommitWorkflow from '../git/CommitWorkflow';
import PushSourceToOrg from '../../impl/sfpcommands/PushSourceToOrg';

export default class SyncOrg {
    constructor(private git: SimpleGit, private sfpProjectConfig: SfpProjectConfig, private devOrg: string) {}

    async execute() {
        // Determine direction
        let statusWorkflow = new SourceStatusWorkflow(this.devOrg);
        let sourceStatusResult = await statusWorkflow.execute();

        let isLocalChanges: boolean = false;
        let isRemoteChanges: boolean = false;
        let isConflict: boolean = false;

        for (let component of sourceStatusResult) {
            if (component.state.endsWith('(Conflict)')) {
                isConflict = true;
                isLocalChanges = true;
                isRemoteChanges = true;
                break;
            }

            if (component.state.startsWith('Local')) {
                isLocalChanges = true;
            }
            if (component.state.startsWith('Remote')) isRemoteChanges = true;
        }

        if (isLocalChanges && isRemoteChanges && isConflict) {
            SFPLogger.log('Source conflict(s) detected', LoggerLevel.WARN);
            let syncDirection = await inquirer.prompt({
                type: 'list',
                name: 'direction',
                message: 'Choose to overwrite local or remote changes',
                choices: [
                    {
                        name: 'Overwrite local changes',
                        value: 'overwriteLocal',
                    },
                    {
                        name: 'Overwrite remote changes',
                        value: 'overwriteRemote',
                    },
                    {
                        name: 'Abort',
                        value: 'abort',
                    },
                ],
            });

            if (syncDirection.direction === 'overwriteLocal') {
                let pullWorkflow: PullSourceWorkflow = new PullSourceWorkflow(
                    this.devOrg,
                    sourceStatusResult,
                    this.sfpProjectConfig.defaultDevHub
                );
                await pullWorkflow.execute();

                await new CommitWorkflow(this.git, this.sfpProjectConfig).execute();

                // Push any non-conflicting locally added components
                await new PushSourceToOrg(this.devOrg).exec();
            } else if (syncDirection.direction === 'overwriteRemote') {
                await new PushSourceToOrg(this.devOrg).exec();
            } else {
                return;
            }
        } else if (isLocalChanges && isRemoteChanges) {
            let pullWorkflow: PullSourceWorkflow = new PullSourceWorkflow(
                this.devOrg,
                sourceStatusResult,
                this.sfpProjectConfig.defaultDevHub
            );
            await pullWorkflow.execute();

            await new CommitWorkflow(this.git, this.sfpProjectConfig).execute();

            await new PushSourceToOrg(this.devOrg).exec();
        } else if (isLocalChanges) {
            await new PushSourceToOrg(this.devOrg).exec();
        } else if (isRemoteChanges) {
            let pullWorkflow: PullSourceWorkflow = new PullSourceWorkflow(
                this.devOrg,
                sourceStatusResult,
                this.sfpProjectConfig.defaultDevHub
            );
            await pullWorkflow.execute();

            await new CommitWorkflow(this.git, this.sfpProjectConfig).execute();
        } else {
            SFPLogger.log(`  ${COLOR_KEY_MESSAGE(`No Changes Detected... `)}`);
        }
    }
}
