import ProjectConfig from '@dxatscale/sfpowerscripts.core/lib/project/ProjectConfig';
import { flags } from '@oclif/command';
import inquirer = require('inquirer');
import CommandsWithInitCheck from '../sharedCommandBase/CommandsWithInitCheck';
import CreatePackageWorkflow from '../workflows/package/CreatePackageWorkflow';
import PackageVersionWorkflow from '../workflows/package/PackageVersionWorkflow';

export default class Package extends CommandsWithInitCheck {
    public static description = 'helpers to deal with packages in your project';

    static flags = {
        help: flags.help({ char: 'h' }),
    };

    protected async executeCommand(): Promise<any> {
        let commandSelected = await this.promptForCommandSelection();
        if (commandSelected == PackageCommand.VERSION_COMMAND) {
            let packageVersionWorkflow: PackageVersionWorkflow = new PackageVersionWorkflow();
            await packageVersionWorkflow.execute();
        } else if (commandSelected == PackageCommand.CREATE_PACKAGE_COMMAND) {
            const projectConfig = ProjectConfig.getSFDXProjectConfig(null);
            let createPackageWorkflow: CreatePackageWorkflow = new CreatePackageWorkflow(projectConfig);
            let newPackage = await createPackageWorkflow.stageANewPackage();
            await createPackageWorkflow.commitStagedPackage(
                this.sfpProjectConfig.defaultDevHub,
                newPackage,
                projectConfig
            );
        }
    }

    private async promptForCommandSelection(): Promise<PackageCommand> {
        const operation = await inquirer.prompt([
            {
                type: 'list',
                name: 'type',
                message: 'Select an operation',
                choices: [
                    { name: 'Manage versions of packages in the project', value: PackageCommand.VERSION_COMMAND },
                    { name: 'Create a new package in the project', value: PackageCommand.CREATE_PACKAGE_COMMAND },
                ],
            },
        ]);
        return operation.type;
    }
}

enum PackageCommand {
    VERSION_COMMAND = 1,
    CREATE_PACKAGE_COMMAND = 2,
}
