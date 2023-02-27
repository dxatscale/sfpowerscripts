import { SimpleGit } from 'simple-git';
import { SfpProjectConfig } from '../../types/SfpProjectConfig';
import ProjectConfig from '@dxatscale/sfpowerscripts.core/lib/project/ProjectConfig';
import SFPLogger from '@dxatscale/sfp-logger/lib/SFPLogger';
import { EOL } from 'os';
import inquirer = require('inquirer');

export default class CommitWorkflow {
    constructor(private git: SimpleGit, private sfpProjectConfig: SfpProjectConfig) {}

    async execute(): Promise<void> {
        const projectConfig = ProjectConfig.getSFDXProjectConfig(null);
        const paths = projectConfig.packageDirectories.filter((elem) => !elem.default).map((elem) => elem.path);
        paths.push('sfdx-project.json');

        const unstagedChanges = await this.getUnstagedChanges(paths);

        const filesToStage = await inquirer.prompt([
            {
                type: 'checkbox',
                name: 'files',
                message: 'Select files to commit',
                choices: this.getChoices(unstagedChanges),
                default: this.getChoices(unstagedChanges).map((choice) => choice.value),
                loop: false,
            },
        ]);

        await this.git.add(filesToStage.files);

        const isStagedChanges = (await this.git.diff(['--staged', '--raw', '--', ...paths])) ? true : false;
        if (isStagedChanges) {
            const message = await inquirer.prompt([
                {
                    type: 'input',
                    name: 'title',
                    message: 'Input commit title',
                    validate: (input, answers) => {
                        if (!input) return 'Commit title cannot be empty';
                        else return true;
                    },
                },
                {
                    type: 'input',
                    name: 'body',
                    message: 'Input commit body',
                    default: '',
                },
            ]);

            let commitMessage = message.title + EOL + EOL + message.body;

            const workItem = this.sfpProjectConfig.getWorkItemGivenBranch((await this.git.branch()).current);
            if (workItem) {
                // Prepend work item ID to commit messsage
                commitMessage = workItem.id + ' ' + commitMessage;
            }

            SFPLogger.log('Committing changes in package directories...');
            await this.git.commit(commitMessage, paths);
        }
    }

    private getChoices(tokenizedDiffResult: { status: string; file: string }[]) {
        return tokenizedDiffResult.map((change) => {
            return {
                name: change.status + '   ' + change.file,
                value: change.file,
            };
        });
    }

    private async getUnstagedChanges(paths: string[]) {
        // track files so that they are included in diff
        await this.git.raw(['add', '--intent-to-add', '--', ...paths]);

        let diffResult = (await this.git.diff(['--name-status', '--', ...paths])).split('\n');
        diffResult.pop(); // Remove empty string at the end of the array

        return this.tokenizeDiffResult(diffResult);
    }

    private tokenizeDiffResult(diffResult: string[]) {
        return diffResult.map((elem) => {
            const status = elem.charAt(0);
            const file = elem.slice(1).trim();

            return {
                status: status,
                file: file,
            };
        });
    }
}
