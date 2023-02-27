import inquirer = require('inquirer');
import { SfpProjectConfig } from '../../types/SfpProjectConfig';
import { WorkItem } from '../../types/WorkItem';

export default class PickAWorkItemWorkflow {
    public constructor(private sfpProjectConfig: SfpProjectConfig) {}

    public async execute() {
        let workItems: WorkItem[] = this.sfpProjectConfig.workItems;
        if (workItems && workItems.length > 0) {
            workItems = workItems
                .filter((elem) => !elem.isDeleted)
                .map((elem) => {
                    elem['name'] = elem.id;
                    return elem;
                });

            let workItem = await inquirer.prompt([
                {
                    type: 'list',
                    name: 'username',
                    message: 'Pick a Work Item',
                    choices: workItems,
                },
            ]);

            return workItem;
        } else {
            throw new Error('No WorkItem found');
        }
    }
}
