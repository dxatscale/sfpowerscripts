const fs = require('fs-extra');
import SFPLogger, { LoggerLevel } from '@dxatscale/sfp-logger';
import _ from 'lodash';
import { PackageType } from '../package/SfpPackage';
let path = require('path');

/**
 * Helper functions for retrieving info from project config
 */
export default class ProjectConfig {
    /**
     * Returns 0H Id of package from project config
     * @param projectConfig
     * @param sfdxPackage
     */
    public static getPackageId(projectConfig: any, sfdxPackage: string) {
        if (projectConfig['packageAliases']?.[sfdxPackage]) {
            return projectConfig['packageAliases'][sfdxPackage];
        } else {
            throw Error('No Package Id found in sfdx-project.json. Please ensure package alias have the package added');
        }
    }

    /**
     * Returns package names, as an array of strings
     * @param projectDirectory
     */
    public static getAllPackages(projectDirectory: string): string[] {
        let projectConfig = ProjectConfig.getSFDXProjectConfig(projectDirectory);
        let sfdxpackages = [];
        projectConfig['packageDirectories'].forEach((pkg) => {
            //Only push packages that have package and versionNumber, ignore everything else
            if (pkg.package && pkg.versionNumber) sfdxpackages.push(pkg.package);
        });
        return sfdxpackages;
    }

    public static getAllExternalPackages(
        projectConfig: any
    ): { alias: string; Package2IdOrSubscriberPackageVersionId: string }[] {
        let externalPackages: { alias: string; Package2IdOrSubscriberPackageVersionId: string }[] = [];
        let packagesInCurrentDirectory = ProjectConfig.getAllPackageDirectoriesFromConfig(projectConfig);
        const packageAliases = projectConfig.packageAliases || {};
        Object.entries(packageAliases).forEach(([key, value]) => {
            if (
                !_.find(
                    packagesInCurrentDirectory,
                    (elem) => {
                        return elem.package == key;
                    },
                    0
                )
            )
                externalPackages.push({ alias: key, Package2IdOrSubscriberPackageVersionId: value as string });
        });
        return externalPackages;
    }

    /**
     * Returns package names from projectConfig, as an array of strings
     * @param projectDirectory
     */
    public static getAllPackagesFromProjectConfig(projectConfig: any): string[] {
        let sfdxpackages = [];
        projectConfig.packageDirectories.forEach((pkg) => {
            //Only push packages that have package and versionNumber, ignore everything else
            if (pkg.package && pkg.versionNumber) sfdxpackages.push(pkg.package);
        });
        return sfdxpackages;
    }

    public static getAllPackagesAndItsDependencies(
        projectConfig: any
    ): Map<string, { package: string; versionNumber?: string }[]> {
        let pkgWithDependencies = new Map<string, { package: string; versionNumber?: string }[]>();
        let packages = ProjectConfig.getAllPackageDirectoriesFromConfig(projectConfig);
        for (let pkg of packages) {
            if (pkg.dependencies) {
                pkgWithDependencies.set(pkg.package, pkg.dependencies);
            }
        }
        return pkgWithDependencies;
    }

    public static getAllPackageDirectoriesFromDirectory(projectDirectory?: string): any[] {
        let projectConfig = ProjectConfig.getSFDXProjectConfig(projectDirectory);
        let sfdxpackages = [];
        projectConfig.packageDirectories?.forEach((pkg) => {
            //Only push packages that have package and versionNumber, ignore everything else
            if (pkg.package && pkg.versionNumber) sfdxpackages.push(pkg);
        });
        return sfdxpackages;
    }

    public static getAllPackageDirectoriesFromConfig(projectConfig: any): any[] {
        let sfdxpackages = [];
        projectConfig.packageDirectories?.forEach((pkg) => {
            //Only push packages that have package and versionNumber, ignore everything else
            if (pkg.package && pkg.versionNumber) sfdxpackages.push(pkg);
        });
        return sfdxpackages;
    }

    /**
     * Returns package manifest as JSON object
     * @param projectDirectory
     */
    public static getSFDXProjectConfig(projectDirectory: string): any {
        let projectConfigJSON: string;

        if (projectDirectory) {
            projectConfigJSON = path.join(projectDirectory, 'sfdx-project.json');
        } else {
            projectConfigJSON = 'sfdx-project.json';
        }

        try {
            return JSON.parse(fs.readFileSync(projectConfigJSON, 'utf8'));
        } catch (error) {
            throw new Error(`sfdx-project.json doesn't exist or not readable at ${projectConfigJSON}`);
        }
    }

    /**
     * Returns type of package
     * @param projectConfig
     * @param sfdxPackage
     */
    public static getPackageType(
        projectConfig: any,
        sfdxPackage: string
    ): PackageType.Unlocked | PackageType.Data | PackageType.Source {
        let packageDescriptor = ProjectConfig.getPackageDescriptorFromConfig(sfdxPackage, projectConfig);

        if (projectConfig['packageAliases']?.[sfdxPackage]) {
            return PackageType.Unlocked;
        } else {
            if (packageDescriptor.type?.toLowerCase() === PackageType.Data) return PackageType.Data;
            else return PackageType.Source;
        }
    }

    /**
     * Returns package descriptor from package manifest at project directory
     * @param projectDirectory
     * @param sfdxPackage
     */
    public static getSFDXPackageDescriptor(projectDirectory: string, sfdxPackage: string): any {
        let projectConfig = ProjectConfig.getSFDXProjectConfig(projectDirectory);

        let sfdxPackageDescriptor = ProjectConfig.getPackageDescriptorFromConfig(sfdxPackage, projectConfig);

        return sfdxPackageDescriptor;
    }

    /**
     * Returns package descriptor from project config JSON object
     * @param sfdxPackage
     * @param projectConfig
     */
    public static getPackageDescriptorFromConfig(sfdxPackage: string, projectConfig: any) {
        let sfdxPackageDescriptor: any;

        if (sfdxPackage) {
            projectConfig['packageDirectories'].forEach((pkg) => {
                if (sfdxPackage == pkg['package']) {
                    sfdxPackageDescriptor = pkg;
                }
            });
        }

        if (sfdxPackageDescriptor == null) throw new Error(`Package ${sfdxPackage} does not exist,Please check inputs`);

        return sfdxPackageDescriptor;
    }

    /**
     * Returns descriptor of default package
     * @param projectDirectory
     */
    public static getDefaultSFDXPackageDescriptor(projectDirectory: string): any {
        let packageDirectory: string;
        let sfdxPackageDescriptor: any;

        let projectConfig = this.getSFDXProjectConfig(projectDirectory);

        //Return the default package directory
        projectConfig['packageDirectories'].forEach((pkg) => {
            if (pkg['default'] == true) {
                packageDirectory = pkg['path'];
                sfdxPackageDescriptor = pkg;
            }
        });

        if (packageDirectory == null) throw new Error('Package or package directory not exist');
        else return sfdxPackageDescriptor;
    }

    /**
     * Returns pruned package manifest, containing sfdxPackage only
     * @param projectDirectory
     * @param sfdxPackage
     */
    public static cleanupMPDFromProjectDirectory(projectDirectory: string, sfdxPackage: string): any {
        const projectConfig = this.getSFDXProjectConfig(projectDirectory);

        return ProjectConfig.cleanupMPDFromProjectConfig(projectConfig, sfdxPackage);
    }

    /**
     * Returns pruned package manifest, containing sfdxPackage only
     * @param projectConfig
     * @param sfdxPackage
     */
    public static cleanupMPDFromProjectConfig(projectConfig: any, sfdxPackage: string): any {
        if (sfdxPackage) {
            let i = projectConfig['packageDirectories'].length;
            while (i--) {
                if (sfdxPackage != projectConfig['packageDirectories'][i]['package']) {
                    projectConfig['packageDirectories'].splice(i, 1);
                }
            }
        } else {
            let i = projectConfig['packageDirectories'].length;
            while (i--) {
                if (!fs.existsSync(projectConfig['packageDirectories'][i]['path'])) {
                    projectConfig['packageDirectories'].splice(i, 1);
                }
            }
        }
        projectConfig['packageDirectories'][0]['default'] = true; //add default = true
        return projectConfig;
    }

    /**
     * Returns pruned package manifest, containing sfdxPackages only
     * @param projectConfig
     * @param sfdxPackages
     */
    public static cleanupPackagesFromProjectConfig(projectConfig: any, sfdxPackages: string[]): any {
        let revisedPackageDirectory = [];
        let originalPackageDirectory = projectConfig['packageDirectories'];
        for (let pkg of originalPackageDirectory) {
            for (const sfdxPackage of sfdxPackages) {
                if (pkg.name == sfdxPackage) {
                    pkg.default = false;
                    revisedPackageDirectory.push(pkg);
                }
            }
        }
        projectConfig['packageDirectories'][0]['default'] = true; //add default = true
        projectConfig.packageDirectories = revisedPackageDirectory;
        return projectConfig;
    }

    /**
     * Returns pruned package manifest, containing sfdxPackages only
     * @param projectConfig
     * @param sfdxPackages
     */
    public static cleanupPackagesFromProjectDirectory(projectDirectory: string, sfdxPackages: string[]): any {
        const projectConfig = this.getSFDXProjectConfig(projectDirectory);
        return ProjectConfig.cleanupPackagesFromProjectConfig(projectConfig, sfdxPackages);
    }

   

    public static async updateProjectConfigWithDependencies(
        projectConfig: any,
        dependencyMap: Map<string, { package: string; versionNumber?: string }[]>
    ) {
        let updatedprojectConfig = await _.cloneDeep(projectConfig);
        updatedprojectConfig.packageDirectories.map((pkg) => {
            return Object.assign(pkg, { dependencies: dependencyMap.get(pkg.package) });
        });

        return updatedprojectConfig;
    }
}
