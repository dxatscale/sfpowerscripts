import { flags } from '@oclif/command';
import inquirer = require('inquirer');
import NewWorkItemWorkflow from '../workflows/workitems/NewWorkItemWorkflow';
import CommandsWithInitCheck from '../sharedCommandBase/CommandsWithInitCheck';
import DeleteWorkItemWorkflow from '../workflows/workitems/DeleteWorkItemWorkflow';
import SubmitWorkItemWorkflow from '../workflows/workitems/SubmitWorkItemWorkflow';

export default class WorkItem extends CommandsWithInitCheck {
    static description = 'create/switch/submit a workitem';

    static flags = {
        help: flags.help({ char: 'h' }),
    };

    async executeCommand() {
        let topic = await this.promptAndCaptureOption();

        if (topic === WorkItemOperations.NEW) {
            let newWorkItemWorkflow: NewWorkItemWorkflow = new NewWorkItemWorkflow(
                this.sfpProjectConfig,
                this.config.configDir
            );
            await newWorkItemWorkflow.execute();
        } else if (topic === WorkItemOperations.SWITCH) {
            let newWorkItemWorkflow: NewWorkItemWorkflow = new NewWorkItemWorkflow(
                this.sfpProjectConfig,
                this.config.configDir
            );
            await newWorkItemWorkflow.execute();
        } else if (topic === WorkItemOperations.DELETE) {
            let deleteWorkItemWorkflow = new DeleteWorkItemWorkflow(this.sfpProjectConfig, this.config.configDir);
            await deleteWorkItemWorkflow.execute();
        } else if (topic === WorkItemOperations.SUBMIT) {
            await new SubmitWorkItemWorkflow(this.sfpProjectConfig).execute();
        }
    }

    private async promptAndCaptureOption(): Promise<WorkItemOperations> {
        const optionPrompt = await inquirer.prompt([
            {
                type: 'list',
                name: 'option',
                message: 'Select an option to proceed?',
                choices: [
                    { name: 'Work on a new item', value: WorkItemOperations.NEW },
                    { name: 'Switch to an existing work item', value: WorkItemOperations.SWITCH },
                    { name: 'Associate a new work item with this branch', value: WorkItemOperations.ASSOCIATE },
                    { name: 'Submit a work item', value: WorkItemOperations.SUBMIT },
                    { name: 'Delete a work item', value: WorkItemOperations.DELETE },
                ],
                default: 'Work on a new item ',
            },
        ]);

        return optionPrompt.option;
    }
}
export enum WorkItemOperations {
    NEW = 0,
    SWITCH = 1,
    ASSOCIATE = 2,
    SUBMIT = 3,
    DELETE = 4,
}
