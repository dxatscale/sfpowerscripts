import inquirer = require('inquirer');
import { SfpProjectConfig } from '../../types/SfpProjectConfig';
import ExternalPackage2DependencyResolver from "@dxatscale/sfpowerscripts.core/lib/package/dependencies/ExternalPackage2DependencyResolver"
import SFPOrg from "@dxatscale/sfpowerscripts.core/lib/org/SFPOrg"
import SFPLogger, { ConsoleLogger, LoggerLevel } from '@dxatscale/sfp-logger';
import InstallUnlockedPackageCollection from "@dxatscale/sfpowerscripts.core/lib/package/packageInstallers/InstallUnlockedPackageCollection"
import ExternalDependencyDisplayer from "@dxatscale/sfpowerscripts.core/lib/display/ExternalDependencyDisplayer"
import ProjectConfig from "@dxatscale/sfpowerscripts.core/lib/project/ProjectConfig"

export default class InstallDependenciesWorkflow {
    private installOrUpdateLabel: string = 'install';

    constructor(private sfpProjectConfig: SfpProjectConfig, private username: string, isUpdateMode: boolean = false) {
        if (isUpdateMode == true) this.installOrUpdateLabel = 'update';
    }

    public async execute() {
        let isPackageDependenciesToBeInstalled = await this.promptForInstallingDependencies();
        if (isPackageDependenciesToBeInstalled) {
            await this.installPackageDependencies();
        }
    }

    private async promptForInstallingDependencies(): Promise<boolean> {
        const isInstallDependenciesConfirmationPrompt = await inquirer.prompt([
            {
                type: 'confirm',
                name: 'install',
                message: `Do you want to ${this.installOrUpdateLabel} all the external package dependencies to this org?`,
            },
        ]);
        return isInstallDependenciesConfirmationPrompt.install;
    }

    private async installPackageDependencies() {

        let hubOrg = await SFPOrg.create({aliasOrUsername:this.sfpProjectConfig.defaultDevHub})

         //Resolve external package dependencies
         let externalPackageResolver = new ExternalPackage2DependencyResolver(
            hubOrg.getConnection(),
            ProjectConfig.getSFDXProjectConfig(null),
            null
        );
        let externalPackage2s = await externalPackageResolver.resolveExternalPackage2DependenciesToVersions();

        SFPLogger.log(
            `Installing external package dependencies of this project  in ${this.username}`,
            LoggerLevel.INFO,
            new ConsoleLogger()
        );
        //Display resolved dependenencies
        let externalDependencyDisplayer = new ExternalDependencyDisplayer(externalPackage2s, new ConsoleLogger());
        externalDependencyDisplayer.display();

        let packageCollectionInstaller = new InstallUnlockedPackageCollection(
            await SFPOrg.create({ aliasOrUsername: this.username }),
            new ConsoleLogger()
        );
        await packageCollectionInstaller.install(externalPackage2s, true, true);
    }
}
