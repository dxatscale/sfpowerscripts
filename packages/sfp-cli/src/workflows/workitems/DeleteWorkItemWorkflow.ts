import SFPLogger, { COLOR_KEY_VALUE } from '@dxatscale/sfp-logger/lib/SFPLogger';
import inquirer = require('inquirer');
import simpleGit, { SimpleGit } from 'simple-git';
import { SfpProjectConfig } from '../../types/SfpProjectConfig';
import { WorkItem } from '../../types/WorkItem';
import DeleteOrgWorkflow from '../org/DeleteOrgWorkflow';
import PickAWorkItemWorkflow from './PickAWorkItemWorkflow';
import * as fs from 'fs-extra';
import path = require('path');

export default class DeleteWorkItemWorkflow {
    private workItem: WorkItem;

    public constructor(private sfpProjectConfig: SfpProjectConfig, private configDir: string) {}

    public async execute() {
        const git: SimpleGit = simpleGit();
        let branches = await git.branch();
        this.workItem = this.sfpProjectConfig.getWorkItemGivenBranch(branches.current);

        if (this.workItem == null) {
            this.workItem = await new PickAWorkItemWorkflow(this.sfpProjectConfig).execute();
        } else {
            let isWorkItemConfirmed = await this.confirmWorkItem();
            if (!isWorkItemConfirmed) this.workItem = await new PickAWorkItemWorkflow(this.sfpProjectConfig).execute();
        }

        SFPLogger.log(`  Switching to default tracking branch ${COLOR_KEY_VALUE(this.workItem.trackingBranch)}`);
        await git.checkout(this.workItem.trackingBranch);
        let isDeleteConfirmation = await this.confirmDeletion();
        if (isDeleteConfirmation) {
            await git.deleteLocalBranch(this.workItem.branch);
        }

        let deleteOrgWorkflow = new DeleteOrgWorkflow(this.sfpProjectConfig, this.workItem.defaultDevOrg);
        await deleteOrgWorkflow.execute();

        //Commit back
        this.sfpProjectConfig.workItems[this.workItem.id] = this.workItem;
        this.sfpProjectConfig.workItems[this.workItem.id].isDeleted = true;

        fs.writeJSONSync(path.join(this.configDir, `${this.sfpProjectConfig.name}.json`), this.sfpProjectConfig);
    }

    async confirmWorkItem() {
        let confirmation = await inquirer.prompt({
            type: 'confirm',
            name: 'result',
            message: `The work item associated with this branch is  ${COLOR_KEY_VALUE(
                this.workItem.id
            )}, Please confirm`,
            default: true,
        });
        return confirmation.result;
    }

    async confirmDeletion() {
        let confirmation = await inquirer.prompt({
            type: 'confirm',
            name: 'result',
            message: `This will delete the associated branch and is not recoverable, Proceed?`,
            default: true,
        });
        return confirmation.result;
    }
}
