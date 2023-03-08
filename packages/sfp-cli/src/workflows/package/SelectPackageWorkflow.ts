import inquirer = require('inquirer');
inquirer.registerPrompt('autocomplete', require('inquirer-autocomplete-prompt'));
const fuzzy = require('fuzzy');
import PackageDiffImpl from '@dxatscale/sfpowerscripts.core/lib/package/diff/PackageDiffImpl';
import SFPLogger, { ConsoleLogger, LoggerLevel } from '@dxatscale/sfp-logger/lib/SFPLogger';

export default class SelectPackageWorkflow {
    constructor(private readonly projectConfig) {}

    /**
     * Supports fuzzy search
     * @returns descriptor of chosen package
     */
    public async pickAnExistingPackage() {
        let existingPackage = await inquirer.prompt([
            {
                type: 'autocomplete',
                name: 'name',
                message: 'Search for package',
                source: (answers, input) => {
                    let packages = this.getNameOfPackages();

                    const defaultPackage = this.getDefaultSfdxPackageDescriptor().package;
                    packages = packages.filter((packageName) => packageName !== defaultPackage);

                    if (input) {
                        return fuzzy.filter(input, packages).map((elem) => elem.string);
                    } else return packages;
                },
                pageSize: 10,
            },
        ]);

        return this.getSfdxPackageDescriptor(existingPackage.name);
    }

    /**
     * Choose one or more packages
     * @returns descriptor of one or more chosen packages
     */
    public async choosePackages(isPackageDiff: boolean) {
        const choices = this.getPackageDirectoriesAsChoices();
        let defaultChoices;

        if (isPackageDiff) {
            const changedPackagesAsChoices = [];

            const logLevelBackup = SFPLogger.logLevel;
            SFPLogger.logLevel = LoggerLevel.WARN; // Ignore INFO logs for PackageDiffImpl

            for (const choice of choices) {
                const packageDiffImpl = new PackageDiffImpl(new ConsoleLogger(), choice.name, null);
                const result = await packageDiffImpl.exec();

                if (result) {
                    changedPackagesAsChoices.push(choice);
                }
            }

            SFPLogger.logLevel = logLevelBackup;

            defaultChoices = changedPackagesAsChoices.map((choice) => choice.value);
        }

        const chosenPackages = await inquirer.prompt([
            {
                type: 'checkbox',
                name: 'packages',
                message: 'Select packages',
                choices: choices,
                default: defaultChoices,
                loop: false,
            },
        ]);

        return chosenPackages.packages;
    }

    private getPackageDirectoriesAsChoices() {
        return this.projectConfig.packageDirectories.map((elem) => {
            return {
                name: elem.package,
                value: elem,
            };
        });
    }

    private getDefaultSfdxPackageDescriptor() {
        return this.projectConfig.packageDirectories.find((pkg) => pkg.default);
    }

    private getSfdxPackageDescriptor(packageName: string) {
        return this.projectConfig.packageDirectories.find((pkg) => pkg.package === packageName);
    }

    private getNameOfPackages(): string[] {
        let nameOfPackages: string[] = [];
        this.projectConfig.packageDirectories.forEach((pkg) => {
            nameOfPackages.push(pkg['package']);
        });
        return nameOfPackages;
    }
}
