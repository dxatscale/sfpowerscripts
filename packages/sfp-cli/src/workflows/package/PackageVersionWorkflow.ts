import ProjectConfig from '@dxatscale/sfpowerscripts.core/lib/project/ProjectConfig';
import inquirer = require('inquirer');
import lodash = require('lodash');
import PackageVersion, { Positional } from '../../impl/package/PackageVersion';
import SelectPackageWorkflow from './SelectPackageWorkflow';
import * as fs from 'fs-extra';
import SFPLogger, {
    COLOR_ERROR,
    COLOR_KEY_MESSAGE,
    COLOR_KEY_VALUE,
    COLOR_SUCCESS,
} from '@dxatscale/sfp-logger/lib/SFPLogger';

export default class PackageVersionWorkflow {
    public async execute() {
        const projectConfig = ProjectConfig.getSFDXProjectConfig(null);
        const oldProjectConfig = lodash.cloneDeep(projectConfig); // for comparison and printing of changes

        const updatedPackageDescriptors = [];

        const mode = await this.getModeSelection();

        if (mode === 'ALL') {
            const positional = await this.getPositional();

            for (const packageDescriptor of projectConfig.packageDirectories) {
                const newPackageVersion = new PackageVersion(packageDescriptor.versionNumber).increment(positional);

                packageDescriptor.versionNumber = newPackageVersion;

                if (packageDescriptor.dependencies) {
                    this.updateVersionOfDependencies(packageDescriptor.dependencies, updatedPackageDescriptors);
                }

                updatedPackageDescriptors.push(packageDescriptor);
            }
        } else if (mode === 'SINGLE') {
            const selectedPackageDescriptor = await new SelectPackageWorkflow(projectConfig).pickAnExistingPackage();

            const newPackageVersion = await this.getNewPackageVersion(selectedPackageDescriptor);

            if (selectedPackageDescriptor.versionNumber !== newPackageVersion) {
                selectedPackageDescriptor.versionNumber = newPackageVersion;
                updatedPackageDescriptors.push(selectedPackageDescriptor);

                const dependentsOfSelectedPackage = PackageVersionWorkflow.getDependentsOfPackage(
                    selectedPackageDescriptor.package,
                    projectConfig
                );

                if (dependentsOfSelectedPackage.length > 0) {
                    SFPLogger.log(
                        ` Proceeding to updating dependents of ${COLOR_KEY_VALUE(selectedPackageDescriptor.package)}`
                    );
                    for (const dependent of dependentsOfSelectedPackage) {
                        const newPackageVersion = await this.getNewPackageVersion(dependent);
                        if (dependent.versionNumber !== newPackageVersion) {
                            dependent.versionNumber = newPackageVersion;
                            if (dependent.dependencies) {
                                // Update dependencies only if the package version has changed
                                this.updateVersionOfDependencies(dependent.dependencies, updatedPackageDescriptors);
                            }
                            updatedPackageDescriptors.push(dependent);
                            // Do not need to recursively update dependents because it is covered by transitive dependencies
                        }
                    }
                }
            }
        } else {
            throw Error(`Unimplemented mode ${mode}`);
        }

        this.printChanges(oldProjectConfig.packageDirectories, updatedPackageDescriptors);

        fs.writeJSONSync('sfdx-project.json', projectConfig, {
            encoding: 'UTF-8',
            spaces: 4,
        });
    }

    private async getPositional(): Promise<Positional> {
        const response = await inquirer.prompt([
            {
                type: 'list',
                name: 'positional',
                message: `Which position would you like to increment all packages by?`,
                choices: [
                    {
                        name: 'Major',
                        value: Positional.MAJOR,
                    },
                    {
                        name: 'Minor',
                        value: Positional.MINOR,
                    },
                    {
                        name: 'Patch',
                        value: Positional.PATCH,
                    },
                ],
            },
        ]);

        return response.positional;
    }

    private async getModeSelection(): Promise<'ALL' | 'SINGLE'> {
        const response = await inquirer.prompt([
            {
                type: 'list',
                name: 'mode',
                message: `Select an option`,
                choices: [
                    {
                        name: `Increment all packages`,
                        value: 'ALL',
                    },
                    {
                        name: `Choose a package to increment`,
                        value: 'SINGLE',
                    },
                ],
            },
        ]);

        return response.mode;
    }

    /**
     * Update version of dependencies to version in package descriptors
     * @param dependencies
     * @param packageDescriptors
     */
    private updateVersionOfDependencies(dependencies: any[], packageDescriptors: any[]) {
        for (const dependency of dependencies) {
            let dependencyName: string;
            if (dependency.versionNumber) {
                dependencyName = dependency.package;
            } else {
                dependencyName = dependency.package.split('@')[0];
            }

            const descriptor = packageDescriptors.find((descriptor) => descriptor.package === dependencyName);
            if (descriptor) {
                const packageVersion = new PackageVersion(descriptor.versionNumber);
                if (packageVersion.buildNum === 'NEXT') {
                    packageVersion.buildNum = 'LATEST';
                }

                if (dependency.versionNumber) {
                    dependency.versionNumber = packageVersion.getVersionNumber();
                } else {
                    dependency.package = `${dependencyName}@${packageVersion.getVersionNumber()}`;
                }
            }
        }
    }

    /**
     * TODO: Replace with method from core library
     * Get all packages which are dependent on the given package
     * @param sfdxPackage name of parent package
     * @param projectConfig
     * @returns an array of dependent packages
     */
    public static getDependentsOfPackage(sfdxPackage: string, projectConfig) {
        const dependentPackages = [];
        projectConfig.packageDirectories.forEach((pkgDir) => {
            if (pkgDir.package !== sfdxPackage) {
                if (pkgDir.dependencies) {
                    const pattern = new RegExp(`^${sfdxPackage}@[0-9]+\\.[0-9]+\\.[0-9]+(\\.[0-9]+|\\.LATEST)?$`);
                    pkgDir.dependencies.forEach((dependency) => {
                        if (dependency.package === sfdxPackage || pattern.test(dependency.package)) {
                            dependentPackages.push(pkgDir);
                        }
                    });
                }
            }
        });
        return dependentPackages;
    }

    private printChanges(oldPackageDescriptors: any[], updatedPackageDescriptors: any[]) {
        console.log('Changes:');
        for (const descriptor of updatedPackageDescriptors) {
            const oldPackageDescriptor = oldPackageDescriptors.find(
                (oldDescriptor) => oldDescriptor.package === descriptor.package
            );
            console.log(
                ' - ',
                `${COLOR_KEY_MESSAGE(oldPackageDescriptor.package)}`,
                `${COLOR_ERROR(oldPackageDescriptor.versionNumber)}`,
                ' => ',
                `${COLOR_SUCCESS(descriptor.versionNumber)}`
            );
        }
    }

    private async getNewPackageVersion(packageDescriptor): Promise<string> {
        const currentVersionNumber = new PackageVersion(packageDescriptor.versionNumber).getVersionNumber();
        const incrementedMajorVersion = new PackageVersion(packageDescriptor.versionNumber).increment(Positional.MAJOR);
        const incrementedMinorVersion = new PackageVersion(packageDescriptor.versionNumber).increment(Positional.MINOR);
        const incrementedPatchVersion = new PackageVersion(packageDescriptor.versionNumber).increment(Positional.PATCH);

        const newPackageVersion = await inquirer.prompt([
            {
                type: 'list',
                name: 'version',
                message: `Select a new version for ${packageDescriptor.package} (currently ${currentVersionNumber})`,
                choices: [
                    {
                        name: `Major (${incrementedMajorVersion})`,
                        value: incrementedMajorVersion,
                    },
                    {
                        name: `Minor (${incrementedMinorVersion})`,
                        value: incrementedMinorVersion,
                    },
                    {
                        name: `Patch (${incrementedPatchVersion})`,
                        value: incrementedPatchVersion,
                    },
                    {
                        name: `Custom Version`,
                        value: 'Custom',
                    },
                    {
                        name: `Skip Package`,
                        value: currentVersionNumber,
                    },
                ],
            },
        ]);

        if (newPackageVersion.version === 'Custom') {
            const customVersion = await this.getCustomVersion();
            return customVersion;
        }

        return newPackageVersion.version;
    }

    private async getCustomVersion(): Promise<string> {
        const customVersion = await inquirer.prompt([
            {
                type: 'input',
                name: 'version',
                message: `Enter a custom version`,
                validate: (input, answers) => {
                    const match = input.match(/^[0-9]+\.[0-9]+\.[0-9]+(\.[0-9]+|\.NEXT)?$/);
                    if (match) {
                        return true;
                    } else {
                        return 'Invalid version number. Must be of the format 1.0.0 , 1.0.0.0 or 1.0.0.0.NEXT';
                    }
                },
            },
        ]);

        return new PackageVersion(customVersion.version).getVersionNumber();
    }
}
