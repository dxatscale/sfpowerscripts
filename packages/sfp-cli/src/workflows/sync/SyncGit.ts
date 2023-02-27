import { SimpleGit } from 'simple-git';
import SFPLogger from '@dxatscale/sfp-logger/lib/SFPLogger';
import { SfpProjectConfig } from '../../types/SfpProjectConfig';
import inquirer = require('inquirer');

export default class SyncGit {
    constructor(private git: SimpleGit, private sfpProjectConfig: SfpProjectConfig) {}

    async execute() {
        SFPLogger.log('Updating remote refs...');
        await this.git.fetch();

        const currentBranch = (await this.git.branch()).current;

        SFPLogger.log(`Updating local branch with remote tracking branch origin/${currentBranch}`);
        await this.git.pull('origin', currentBranch);

        const workItem = this.sfpProjectConfig.getWorkItemGivenBranch(currentBranch);
        const parentBranch = workItem.trackingBranch;

        SFPLogger.log(`Updating local branch with parent branch origin/${parentBranch}`);
        await this.git.pull('origin', parentBranch);

        let response = await inquirer.prompt({
            type: 'confirm',
            name: 'isPush',
            message: 'Push to remote tracking branch?',
        });

        if (response.isPush) {
            SFPLogger.log(`Pushing to origin/${currentBranch}`);
            await this.git.push('origin', currentBranch);
        }
    }
}
