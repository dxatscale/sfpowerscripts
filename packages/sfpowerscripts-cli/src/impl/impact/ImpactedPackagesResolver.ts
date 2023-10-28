import PackageDiffImpl, { PackageDiffOptions } from '@dxatscale/sfpowerscripts.core/lib/package/diff/PackageDiffImpl';
import { Stage } from '../Stage';
import ProjectConfig from '@dxatscale/sfpowerscripts.core/lib/project/ProjectConfig';
import { PackageType } from '@dxatscale/sfpowerscripts.core/lib/package/SfpPackage';
import * as fs from 'fs-extra';
import { Logger } from '@dxatscale/sfp-logger';
import BuildCollections from '../parallelBuilder/BuildCollections';

export interface ImpactedPackageProps {
    projectDirectory?: string;
    branch?: string;
    configFilePath?: string;
    currentStage: Stage;
    baseBranch?: string;
    diffOptions?: PackageDiffOptions;
    includeOnlyPackages?: string[];
}

export default class ImpactedPackageResolver {


    constructor(private props: ImpactedPackageProps, private logger: Logger) {
    }

    async getImpactedPackages(): Promise<Map<string, any>> {
        let projectConfig = ProjectConfig.getSFDXProjectConfig(this.props.projectDirectory);
        let packagesToBeBuilt = this.getPackagesToBeBuilt(this.props.projectDirectory);
        let packagesToBeBuiltWithReasons = await this.filterPackagesToBeBuiltByChanged(
            this.props.projectDirectory,
            projectConfig,
            packagesToBeBuilt
        );

        return packagesToBeBuiltWithReasons;
    }

    /**
     * Get the file path of the forceignore for current stage, from project config.
     * Returns null if a forceignore path is not defined in the project config for the current stage.
     *
     * @param projectConfig
     * @param currentStage
     */
    private getPathToForceIgnoreForCurrentStage(projectConfig: any, currentStage: Stage): string {
        let stageForceIgnorePath: string;

        let ignoreFiles: { [key in Stage]: string } = projectConfig.plugins?.sfpowerscripts?.ignoreFiles;
        if (ignoreFiles) {
            Object.keys(ignoreFiles).forEach((key) => {
                if (key.toLowerCase() == currentStage) {
                    stageForceIgnorePath = ignoreFiles[key];
                }
            });
        }

        if (stageForceIgnorePath) {
            if (fs.existsSync(stageForceIgnorePath)) {
                return stageForceIgnorePath;
            } else throw new Error(`${stageForceIgnorePath} forceignore file does not exist`);
        } else return null;
    }

    private async filterPackagesToBeBuiltByChanged(projectDirectory: string,projectConfig:any, allPackagesInRepo: any) {
        let packagesToBeBuilt = new Map<string, any>();
        let buildCollections = new BuildCollections(projectDirectory);
        if (this.props.diffOptions)
            this.props.diffOptions.pathToReplacementForceIgnore = this.getPathToForceIgnoreForCurrentStage(
                projectConfig,
                this.props.currentStage
            );

        for await (const pkg of allPackagesInRepo) {
            let diffImpl: PackageDiffImpl = new PackageDiffImpl(
                this.logger,
                pkg,
                this.props.projectDirectory,
                this.props.diffOptions
            );
            let packageDiffCheck = await diffImpl.exec();

            if (packageDiffCheck.isToBeBuilt) {
                packagesToBeBuilt.set(pkg, {
                    reason: packageDiffCheck.reason,
                    tag: packageDiffCheck.tag,
                });
                //Add Bundles
                if (buildCollections.isPackageInACollection(pkg)) {
                    buildCollections.listPackagesInCollection(pkg).forEach((packageInCollection) => {
                        if (!packagesToBeBuilt.has(packageInCollection)) {
                            packagesToBeBuilt.set(packageInCollection, {
                                reason: 'Part of a build collection',
                            });
                        }
                    });
                }
            }
        }
        return packagesToBeBuilt;
    }

    private getPackagesToBeBuilt(projectDirectory: string, includeOnlyPackages?: string[]): string[] {
        let projectConfig = ProjectConfig.getSFDXProjectConfig(projectDirectory);
        let sfdxpackages = [];

        let packageDescriptors = projectConfig['packageDirectories'].filter((pkg) => {
            if (
                pkg.ignoreOnStage?.find((stage) => {
                    stage = stage.toLowerCase();
                    return stage === this.props.currentStage;
                })
            )
                return false;
            else return true;
        });

        //Filter Packages
        if (includeOnlyPackages) {
            packageDescriptors = packageDescriptors.filter((pkg) => {
                if (
                    includeOnlyPackages.find((includedPkg) => {
                        return includedPkg == pkg.package;
                    })
                )
                    return true;
                else return false;
            });
        }

        //       Ignore aliasfied packages on  stages fix #1289
        packageDescriptors = packageDescriptors.filter((pkg) => {
            return !(this.props.currentStage === 'prepare' && pkg.aliasfy && pkg.type !== PackageType.Data);
        });

        for (const pkg of packageDescriptors) {
            if (pkg.package && pkg.versionNumber) sfdxpackages.push(pkg['package']);
        }
        return sfdxpackages;
    }

}
