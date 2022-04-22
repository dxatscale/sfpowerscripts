import ArtifactFilePathFetcher, {
    ArtifactFilePaths,
} from '@dxatscale/sfpowerscripts.core/lib/artifacts/ArtifactFilePathFetcher';
import PackageMetadata from '@dxatscale/sfpowerscripts.core/lib/PackageMetadata';
import ArtifactInquirer from '@dxatscale/sfpowerscripts.core/lib/artifacts/ArtifactInquirer';
import fs = require('fs');
import path = require('path');
import SFPLogger, { Logger, LoggerLevel } from '@dxatscale/sfpowerscripts.core/lib/logger/SFPLogger';
import { EOL } from 'os';
import { Stage } from '../Stage';
import ProjectConfig from '@dxatscale/sfpowerscripts.core/lib/project/ProjectConfig';
import semver = require('semver');
import PromoteUnlockedPackageImpl from '@dxatscale/sfpowerscripts.core/lib/sfdxwrappers/PromoteUnlockedPackageImpl';
import { DeploymentType } from '@dxatscale/sfpowerscripts.core/lib/deployers/DeploymentExecutor';
import { COLOR_KEY_MESSAGE } from '@dxatscale/sfpowerscripts.core/lib/logger/SFPLogger';
import { COLOR_HEADER } from '@dxatscale/sfpowerscripts.core/lib/logger/SFPLogger';
import {
    PackageInstallationResult,
    PackageInstallationStatus,
} from '@dxatscale/sfpowerscripts.core/lib/package/packageInstallers/PackageInstallationResult';
import InstallUnlockedPackageImpl from '@dxatscale/sfpowerscripts.core/lib/package/packageInstallers/InstallUnlockedPackageImpl';
import InstallSourcePackageImpl from '@dxatscale/sfpowerscripts.core/lib/package/packageInstallers/InstallSourcePackageImpl';
import InstallDataPackageImpl from '@dxatscale/sfpowerscripts.core/lib/package/packageInstallers/InstallDataPackageImpl';
import SFPOrg from '@dxatscale/sfpowerscripts.core/lib/org/SFPOrg';
import { Connection } from '@salesforce/core';
import { UpsertResult } from 'jsforce';
import SFPPackage from '@dxatscale/sfpowerscripts.core/lib/package/SFPPackage';
import { PostDeployHook } from './PostDeployHook';
import { PreDeployHook } from './PreDeployHook';
const Table = require('cli-table');
const retry = require('async-retry');

export enum DeploymentMode {
    NORMAL,
    SOURCEPACKAGES,
    SOURCEPACKAGES_PUSH,
}

export interface DeployProps {
    targetUsername: string;
    artifactDir: string;
    deploymentMode: DeploymentMode;
    isTestsToBeTriggered: boolean;
    skipIfPackageInstalled: boolean;
    logsGroupSymbol?: string[];
    waitTime: number;
    tags?: any;
    packageLogger?: Logger;
    currentStage?: Stage;
    baselineOrg?: string;
    isDryRun?: boolean;
    isRetryOnFailure?: boolean;
    promotePackagesBeforeDeploymentToOrg?: string;
    devhubUserName?: string;
    disableArtifactCommit?: boolean;
    isFastFeedbackMode?:boolean;
}

export default class DeployImpl {
    private _postDeployHook: PostDeployHook;
    private _preDeployHook: PreDeployHook;

    constructor(private props: DeployProps) {}

    public set postDeployHook(hook: PostDeployHook) {
        this._postDeployHook = hook;
    }

    public set preDeployHook(hook: PreDeployHook) {
        this._preDeployHook = hook;
    }

    // TODO: Refactor to use exception pattern
    public async exec(): Promise<DeploymentResult> {
        let deployed: PackageInfo[] = [];
        let failed: PackageInfo[] = [];
        let queue;
        let packagesToPackageInfo: { [p: string]: PackageInfo };
        try {
            let artifacts = ArtifactFilePathFetcher.fetchArtifactFilePaths(
                this.props.artifactDir,
                null,
                this.props.packageLogger
            );

            if (artifacts.length === 0) throw new Error(`No artifacts to deploy found in ${this.props.artifactDir}`);

            let artifactInquirer: ArtifactInquirer = new ArtifactInquirer(artifacts, this.props.packageLogger);
            let packageManifest = artifactInquirer.latestPackageManifestFromArtifacts;

            if (packageManifest == null) {
                // If unable to find latest package manfest in artifacts, use package manifest in project directory
                packageManifest = ProjectConfig.getSFDXPackageManifest(null);
            }

            packagesToPackageInfo = this.getPackagesToPackageInfo(artifacts);

            queue = this.getPackagesToDeploy(packageManifest, packagesToPackageInfo);

            if (this.props.skipIfPackageInstalled) {
                //Filter the queue based on what is deployed in the target org
                let isBaselinOrgModeActivated: boolean;
                if (this.props.baselineOrg) {
                    isBaselinOrgModeActivated = true;
                } else {
                    isBaselinOrgModeActivated = false;
                    this.props.baselineOrg = this.props.targetUsername; //Change baseline to the target one itself
                }

                let filteredDeploymentQueue = await this.filterByPackagesInstalledInTheOrg(
                    packageManifest,
                    queue,
                    packagesToPackageInfo,
                    this.props.baselineOrg
                );
                this.printArtifactVersionsWhenSkipped(queue, packagesToPackageInfo, isBaselinOrgModeActivated);
                queue = filteredDeploymentQueue;
            } else {
                this.printArtifactVersions(queue, packagesToPackageInfo);
            }

            for (let i = 0; i < queue.length; i++) {
                let packageInfo = packagesToPackageInfo[queue[i].package];
                let packageMetadata: PackageMetadata = packageInfo.packageMetadata;

                let packageType: string = packageMetadata.package_type;

                let pkgDescriptor = ProjectConfig.getPackageDescriptorFromConfig(queue[i].package, packageManifest);

                this.printOpenLoggingGroup('Installing ', queue[i].package);
                this.displayHeader(packageMetadata, pkgDescriptor, queue[i].package);

                //TODO:this is not accurate
                let sfpPackage = await SFPPackage.buildPackageFromProjectConfig(
                    this.props.packageLogger,
                    packageInfo.sourceDirectory,
                    queue[i].package
                );

                let preHookStatus = await this._preDeployHook?.preDeployPackage(
                    sfpPackage,
                    this.props.targetUsername,
                    this.props.devhubUserName
                );
                if (preHookStatus?.isToFailDeployment) {
                    failed = queue.slice(i).map((pkg) => packagesToPackageInfo[pkg.package]);
                    throw new Error(
                        preHookStatus.message
                            ? preHookStatus.message
                            : 'Hook Failed to execute, but didnt provide proper message'
                    );
                }

                let packageInstallationResult: PackageInstallationResult = await retry(
                    async (bail, count) => {
                        try {
                            await this.promotePackagesBeforeInstallation(packageInfo.sourceDirectory, packageMetadata);

                            this.displayRetryHeader(this.props.isRetryOnFailure, count);

                            let installPackageResult = await this.installPackage(
                                packageType,
                                queue[i].package,
                                this.props.targetUsername,
                                packageInfo.sourceDirectory,
                                packageMetadata,
                                queue[i].skipTesting,
                                this.props.waitTime.toString(),
                                pkgDescriptor,
                                false, //Queue already filtered by deploy, there is no further need for individual
                                //commands to decide the skip logic. TODO: fix this incorrect pattern
                                packageMetadata.apiVersion || packageMetadata.payload?.Package?.version // Use package.xml version for backwards compat with old artifacts
                            );

                            if (
                                this.props.isRetryOnFailure &&
                                installPackageResult.result === PackageInstallationStatus.Failed &&
                                count === 1
                            ) {
                                throw new Error(installPackageResult.message);
                            } else return installPackageResult;
                        } catch (error) {
                            if (!this.props.isRetryOnFailure) {
                                // Any other exception, in regular cases dont retry, just bail out
                                let failedPackageInstallationResult: PackageInstallationResult = {
                                    result: PackageInstallationStatus.Failed,
                                    message: error,
                                };
                                return failedPackageInstallationResult;
                            } else throw error;
                        }
                    },
                    { retries: 1, minTimeout: 2000 }
                );

                if (packageInstallationResult.result === PackageInstallationStatus.Succeeded) {
                    deployed.push(packageInfo);
                } else if (packageInstallationResult.result === PackageInstallationStatus.Skipped) {
                    continue;
                } else if (packageInstallationResult.result === PackageInstallationStatus.Failed) {
                    failed = queue.slice(i).map((pkg) => packagesToPackageInfo[pkg.package]);
                }

                let postHookStatus = await this._postDeployHook?.postDeployPackage(
                    sfpPackage,
                    packageInstallationResult,
                    this.props.targetUsername,
                    this.props.devhubUserName
                );

                if (postHookStatus?.isToFailDeployment) {
                    failed = queue.slice(i).map((pkg) => packagesToPackageInfo[pkg.package]);
                    throw new Error(
                        postHookStatus.message
                            ? postHookStatus.message
                            : 'Hook Failed to execute, but didnt provide proper message'
                    );
                }

                if (packageInstallationResult.result === PackageInstallationStatus.Failed) {
                    failed = queue.slice(i).map((pkg) => packagesToPackageInfo[pkg.package]);
                    throw new Error(packageInstallationResult.message);
                }

                this.printClosingLoggingGroup();
            }

            return {
                scheduled: queue.length,
                deployed: deployed,
                failed: failed,
                queue: queue,
                packagesToPackageInfo: packagesToPackageInfo,
                error: null,
            };
        } catch (err) {
            SFPLogger.log(err, LoggerLevel.ERROR, this.props.packageLogger);

            return {
                scheduled: queue?.length ? queue.length : 0,
                deployed: deployed,
                failed: failed,
                queue: queue,
                packagesToPackageInfo: packagesToPackageInfo,
                error: err,
            };
        }
    }

    private async promotePackagesBeforeInstallation(sourceDirectory: string, packageMetadata: any) {
        if (this.props.promotePackagesBeforeDeploymentToOrg === this.props.targetUsername) {
            if (packageMetadata.package_type === 'unlocked') {
                console.log(
                    COLOR_KEY_MESSAGE(
                        `Attempting to promote package ${packageMetadata.package_name} before installation`
                    )
                );
                let promoteUnlockedPackageImpl: PromoteUnlockedPackageImpl = new PromoteUnlockedPackageImpl(
                    sourceDirectory,
                    packageMetadata.package_version_id,
                    this.props.devhubUserName
                );
                await promoteUnlockedPackageImpl.exec();
            }
        }
    }

    private displayRetryHeader(isRetryOnFailure: boolean, count: number) {
        if (isRetryOnFailure && count > 1) {
            SFPLogger.log(
                `-------------------------------------------------------------------------------${EOL}`,
                LoggerLevel.INFO,
                this.props.packageLogger
            );

            SFPLogger.log(`Retrying On Failure Attempt: ${count}`, LoggerLevel.INFO, this.props.packageLogger);
            SFPLogger.log(
                `-------------------------------------------------------------------------------${EOL}`,
                LoggerLevel.INFO,
                this.props.packageLogger
            );
        }
    }

    private displayHeader(packageMetadata: PackageMetadata, pkgDescriptor: any, pkg: string) {
        let alwaysDeployMessage: string;

        if (this.props.skipIfPackageInstalled) {
            if (pkgDescriptor.alwaysDeploy) alwaysDeployMessage = `Always Deploy: ${COLOR_KEY_MESSAGE(`True`)}`;
            else alwaysDeployMessage = `Always Deploy: ${COLOR_KEY_MESSAGE(`False`)}`;
        } else alwaysDeployMessage = undefined;

        //Display header
        SFPLogger.log(
            COLOR_HEADER(`----------------------------------Installing Package---------------------------------------------`),
            LoggerLevel.INFO,
            this.props.packageLogger
        );
        SFPLogger.log(COLOR_HEADER(`Name: ${COLOR_KEY_MESSAGE(pkg)}`), LoggerLevel.INFO, this.props.packageLogger);
        SFPLogger.log(
            `Type: ${COLOR_KEY_MESSAGE(packageMetadata.package_type)}`,
            LoggerLevel.INFO,
            this.props.packageLogger
        );
        SFPLogger.log(
            `Version Number: ${COLOR_KEY_MESSAGE(packageMetadata.package_version_number)}`,
            LoggerLevel.INFO,
            this.props.packageLogger
        );
        if (pkgDescriptor.aliasfy)
            SFPLogger.log(
                `Aliasified Package: ${COLOR_KEY_MESSAGE(`True`)}`,
                LoggerLevel.INFO,
                this.props.packageLogger
            );
        SFPLogger.log(
            `Contains Apex Classes/Triggers: ${COLOR_KEY_MESSAGE(packageMetadata.isApexFound)}`,
            LoggerLevel.INFO,
            this.props.packageLogger
        );
        if (packageMetadata.package_type == 'source' || packageMetadata.package_type == 'unlocked') {
            if (!pkgDescriptor.aliasfy)
                SFPLogger.log(
                    `Metadata Count: ${COLOR_KEY_MESSAGE(packageMetadata.metadataCount)}`,
                    LoggerLevel.INFO,
                    this.props.packageLogger
                );
        }
        if (alwaysDeployMessage) SFPLogger.log(alwaysDeployMessage, LoggerLevel.INFO, this.props.packageLogger);

        SFPLogger.log(
            COLOR_HEADER(`-------------------------------------------------------------------------------------------------`),
            LoggerLevel.INFO,
            this.props.packageLogger
        );
    }

    private printArtifactVersionsWhenSkipped(
        queue: any[],
        packagesToPackageInfo: { [p: string]: PackageInfo },
        isBaselinOrgModeActivated: boolean
    ) {
        this.printOpenLoggingGroup(`Full Deployment Breakdown`);
        let maxTable = new Table({
            head: [
                'Package',
                'Incoming Version',
                isBaselinOrgModeActivated ? 'Version in baseline org' : 'Version in org',
                'To be installed?',
            ],
        });

        queue.forEach((pkg) => {
            maxTable.push([
                pkg.package,
                packagesToPackageInfo[pkg.package].packageMetadata.package_version_number,
                packagesToPackageInfo[pkg.package].versionInstalledInOrg
                    ? packagesToPackageInfo[pkg.package].versionInstalledInOrg
                    : 'N/A',
                packagesToPackageInfo[pkg.package].isPackageInstalled ? 'No' : 'Yes',
            ]);
        });
        console.log(maxTable.toString());
        this.printClosingLoggingGroup();

        this.printOpenLoggingGroup(`Packages to be deployed`);
        let minTable = new Table({
            head: [
                'Package',
                'Incoming Version',
                isBaselinOrgModeActivated ? 'Version in baseline org' : 'Version in org',
            ],
        });

        queue.forEach((pkg) => {
            if (!packagesToPackageInfo[pkg.package].isPackageInstalled)
                minTable.push([
                    pkg.package,
                    packagesToPackageInfo[pkg.package].packageMetadata.package_version_number,
                    packagesToPackageInfo[pkg.package].versionInstalledInOrg
                        ? packagesToPackageInfo[pkg.package].versionInstalledInOrg
                        : 'N/A',
                ]);
        });
        console.log(minTable.toString());
        this.printClosingLoggingGroup();
    }

    private printArtifactVersions(queue: any[], packagesToPackageInfo: { [p: string]: PackageInfo }) {
        this.printOpenLoggingGroup(`Packages to be deployed`);
        let table = new Table({
            head: ['Package', 'Version to be installed'],
        });

        queue.forEach((pkg) => {
            table.push([pkg.package, packagesToPackageInfo[pkg.package].packageMetadata.package_version_number]);
        });
        SFPLogger.log(table.toString(), LoggerLevel.INFO, this.props.packageLogger);
        this.printClosingLoggingGroup();
    }

    private async filterByPackagesInstalledInTheOrg(
        packageManifest: any,
        queue: any[],
        packagesToPackageInfo: { [p: string]: PackageInfo },
        targetUsername: string
    ): Promise<any[]> {
        //Create Org
        let org = await SFPOrg.create({ aliasOrUsername: targetUsername });

        const clonedQueue = [];
        queue.forEach((val) => clonedQueue.push(Object.assign({}, val)));

        for (let i = queue.length - 1; i >= 0; i--) {
            let packageInfo = packagesToPackageInfo[clonedQueue[i].package];
            let packageMetadata: PackageMetadata = packageInfo.packageMetadata;
            let pkgDescriptor = ProjectConfig.getPackageDescriptorFromConfig(clonedQueue[i].package, packageManifest);
            let packageInstalledInTheOrg = await org.isArtifactInstalledInOrg(
                this.props.packageLogger,
                packageMetadata
            );
            if (packageInstalledInTheOrg.versionNumber)
                packageInfo.versionInstalledInOrg = packageInstalledInTheOrg.versionNumber;
            if (packageInstalledInTheOrg.isInstalled) {
                if (!pkgDescriptor.alwaysDeploy) {
                    packageInfo.isPackageInstalled = true;
                    clonedQueue.splice(i, 1);
                }
            }
        }

        return clonedQueue;
    }

    private printOpenLoggingGroup(message: string, pkg?: string) {
        if (this.props.logsGroupSymbol?.[0])
            SFPLogger.log(
                `${this.props.logsGroupSymbol[0]} ${message}   ${pkg ? pkg : ''}`,
                LoggerLevel.INFO,
                this.props.packageLogger
            );
    }

    private printClosingLoggingGroup() {
        if (this.props.logsGroupSymbol?.[1])
            SFPLogger.log(this.props.logsGroupSymbol[1], LoggerLevel.INFO, this.props.packageLogger);
    }

    /**
     * Returns map of package name to package info
     * @param artifacts
     */
    private getPackagesToPackageInfo(artifacts: ArtifactFilePaths[]): { [p: string]: PackageInfo } {
        let packagesToPackageInfo: { [p: string]: PackageInfo } = {};

        for (let artifact of artifacts) {
            let packageMetadata: PackageMetadata = JSON.parse(
                fs.readFileSync(artifact.packageMetadataFilePath, 'utf8')
            );

            if (packagesToPackageInfo[packageMetadata.package_name]) {
                let previousVersionNumber = this.convertBuildNumDotDelimToHyphen(
                    packagesToPackageInfo[packageMetadata.package_name].packageMetadata.package_version_number
                );
                let currentVersionNumber = this.convertBuildNumDotDelimToHyphen(packageMetadata.package_version_number);

                // replace existing packageInfo if package version number is newer
                if (semver.gt(currentVersionNumber, previousVersionNumber)) {
                    packagesToPackageInfo[packageMetadata.package_name] = {
                        sourceDirectory: artifact.sourceDirectoryPath,
                        packageMetadata: packageMetadata,
                    };
                }
            } else {
                packagesToPackageInfo[packageMetadata.package_name] = {
                    sourceDirectory: artifact.sourceDirectoryPath,
                    packageMetadata: packageMetadata,
                };
            }
        }
        return packagesToPackageInfo;
    }

    /**
     * Converts build-number dot delimeter to hyphen
     * If dot delimeter does not exist, returns input
     * @param version
     */
    private convertBuildNumDotDelimToHyphen(version: string) {
        let convertedVersion = version;

        let indexOfBuildNumDelimiter = this.getIndexOfBuildNumDelimeter(version);
        if (version[indexOfBuildNumDelimiter] === '.') {
            convertedVersion =
                version.substring(0, indexOfBuildNumDelimiter) + '-' + version.substring(indexOfBuildNumDelimiter + 1);
        }
        return convertedVersion;
    }

    /**
     * Get the index of the build-number delimeter
     * Returns null if unable to find index of delimeter
     * @param version
     */
    private getIndexOfBuildNumDelimeter(version: string) {
        let numOfDelimetersTraversed: number = 0;
        for (let i = 0; i < version.length; i++) {
            if (!Number.isInteger(parseInt(version[i], 10))) {
                numOfDelimetersTraversed++;
            }
            if (numOfDelimetersTraversed === 3) {
                return i;
            }
        }
        return null;
    }

    /**
     * Decider for which package installation type to run
     */
    private async installPackage(
        packageType: string,
        sfdx_package: string,
        targetUsername: string,
        sourceDirectoryPath: string,
        packageMetadata: PackageMetadata,
        skipTesting: boolean,
        waitTime: string,
        pkgDescriptor: any,
        skipIfPackageInstalled: boolean,
        apiVersion: string
    ): Promise<PackageInstallationResult> {
        let packageInstallationResult: PackageInstallationResult;

        if (this.props.deploymentMode == DeploymentMode.NORMAL) {
            if (packageType === 'unlocked') {
                let options = {
                    installationkey: null,
                    apexcompile: 'package',
                    securitytype: 'AdminsOnly',
                    upgradetype: 'Mixed',
                    waitTime: waitTime,
                    apiVersion: apiVersion,
                    publishWaitTime: 60,
                };

                packageInstallationResult = await this.installUnlockedPackage(
                    targetUsername,
                    sourceDirectoryPath,
                    packageMetadata,
                    options,
                    skipIfPackageInstalled
                );
            } else if (packageType === 'source') {
                let options = {
                    optimizeDeployment: this.isOptimizedDeploymentForSourcePackage(pkgDescriptor),
                    skipTesting: skipTesting,
                    waitTime: waitTime,
                    apiVersion: apiVersion,
                };

                packageInstallationResult = await this.installSourcePackage(
                    sfdx_package,
                    targetUsername,
                    sourceDirectoryPath,
                    packageMetadata,
                    options,
                    skipIfPackageInstalled
                );
            } else if (packageType === 'data') {
                packageInstallationResult = await this.installDataPackage(
                    sfdx_package,
                    targetUsername,
                    sourceDirectoryPath,
                    packageMetadata,
                    skipIfPackageInstalled
                );
            } else {
                throw new Error(`Unhandled package type ${packageType}`);
            }
        } else if (
            this.props.deploymentMode === DeploymentMode.SOURCEPACKAGES ||
            this.props.deploymentMode === DeploymentMode.SOURCEPACKAGES_PUSH
        ) {
            if (packageType === 'source' || packageType === 'unlocked') {
                let options = {
                    optimizeDeployment: false,
                    skipTesting: true,
                    waitTime: waitTime,
                    apiVersion: apiVersion,
                };

                packageInstallationResult = await this.installSourcePackage(
                    sfdx_package,
                    targetUsername,
                    sourceDirectoryPath,
                    packageMetadata,
                    options,
                    skipIfPackageInstalled
                );
            } else if (packageType === 'data') {
                packageInstallationResult = await this.installDataPackage(
                    sfdx_package,
                    targetUsername,
                    sourceDirectoryPath,
                    packageMetadata,
                    skipIfPackageInstalled
                );
            } else {
                throw new Error(`Unhandled package type ${packageType}`);
            }
        }
        return packageInstallationResult;
    }

    private installUnlockedPackage(
        targetUsername: string,
        sourceDirectoryPath: string,
        packageMetadata: PackageMetadata,
        options: any,
        skip_if_package_installed: boolean
    ): Promise<PackageInstallationResult> {
        let installUnlockedPackageImpl: InstallUnlockedPackageImpl = new InstallUnlockedPackageImpl(
            packageMetadata.package_name,
            targetUsername,
            options,
            skip_if_package_installed,
            packageMetadata,
            sourceDirectoryPath,
            this.props.packageLogger,
            this.props.isDryRun
        );
        installUnlockedPackageImpl.isArtifactToBeCommittedInOrg = !this.props.disableArtifactCommit;
        return installUnlockedPackageImpl.exec();
    }

    private installSourcePackage(
        sfdx_package: string,
        targetUsername: string,
        sourceDirectoryPath: string,
        packageMetadata: PackageMetadata,
        options: any,
        skip_if_package_installed: boolean
    ): Promise<PackageInstallationResult> {
        let installSourcePackageImpl: InstallSourcePackageImpl = new InstallSourcePackageImpl(
            sfdx_package,
            targetUsername,
            sourceDirectoryPath,
            options,
            skip_if_package_installed,
            packageMetadata,
            this.props.packageLogger,
            this.props.currentStage == 'prepare'
                ? path.join(sourceDirectoryPath, 'forceignores', '.prepareignore')
                : null,
            this.props.deploymentMode === DeploymentMode.SOURCEPACKAGES_PUSH
                ? DeploymentType.SOURCE_PUSH
                : this.props.isFastFeedbackMode?DeploymentType.SELECTIVE_MDAPI_DEPLOY:DeploymentType.MDAPI_DEPLOY,
            this.props.isDryRun
        );
        installSourcePackageImpl.isArtifactToBeCommittedInOrg = !this.props.disableArtifactCommit;
        return installSourcePackageImpl.exec();
    }

    private installDataPackage(
        sfdx_package: string,
        targetUsername: string,
        sourceDirectoryPath: string,
        packageMetadata: PackageMetadata,
        skip_if_package_installed: boolean
    ): Promise<PackageInstallationResult> {
        let installDataPackageImpl: InstallDataPackageImpl = new InstallDataPackageImpl(
            sfdx_package,
            targetUsername,
            sourceDirectoryPath,
            packageMetadata,
            skip_if_package_installed,
            this.props.packageLogger,
            LoggerLevel.INFO,
            this.props.isDryRun
        );
        installDataPackageImpl.isArtifactToBeCommittedInOrg = !this.props.disableArtifactCommit;
        return installDataPackageImpl.exec();
    }

    /**
     * Checks if package should be installed to target username
     * @param packageDescriptor
     */
    private isSkipDeployment(packageDescriptor: any, targetUsername: string): boolean {
        let skipDeployOnOrgs: string[] = packageDescriptor.skipDeployOnOrgs;
        if (skipDeployOnOrgs) {
            if (!(skipDeployOnOrgs instanceof Array))
                throw new Error(`Property 'skipDeployOnOrgs' must be of type Array`);
            else return skipDeployOnOrgs.includes(targetUsername);
        } else return false;
    }

    // Allow individual packages to use non optimized path
    private isOptimizedDeploymentForSourcePackage(pkgDescriptor: any): boolean {
        if (pkgDescriptor['isOptimizedDeployment'] == null) return true;
        else return pkgDescriptor['isOptimizedDeployment'];
    }

    /**
     * Returns the packages in the project config that have an artifact
     */
    private getPackagesToDeploy(packageManifest: any, packagesToPackageInfo: { [p: string]: PackageInfo }): any[] {
        let packagesToDeploy: any[];

        let packages = packageManifest['packageDirectories'];

        // Filter package manifest by artifact
        packagesToDeploy = packages.filter((pkg) => {
            return packagesToPackageInfo[pkg.package];
        });

        // Filter out packages that are to be skipped on the target org
        packagesToDeploy = packagesToDeploy.filter((pkg) => !this.isSkipDeployment(pkg, this.props.targetUsername));

        //Ignore packages based on stage
        packagesToDeploy = packagesToDeploy.filter((pkg) => {
            if (
                pkg.ignoreOnStage?.find((stage) => {
                    stage = stage.toLowerCase();
                    return stage === this.props.currentStage;
                })
            )
                return false;
            else return true;
        });

        // Ignore aliasfied packages on validate & prepare stages
        packagesToDeploy = packagesToDeploy.filter((pkg) => {
            return !(
                (this.props.currentStage === 'prepare' || this.props.currentStage === 'validate') &&
                pkg.aliasfy &&
                pkg.type !== 'data'
            );
        });

        if (packagesToDeploy == null || packagesToDeploy.length === 0)
            throw new Error(`No artifacts from project config to be deployed`);
        else return packagesToDeploy;
    }
}

export interface PackageInfo {
    sourceDirectory: string;
    packageMetadata: PackageMetadata;
    versionInstalledInOrg?: string;
    isPackageInstalled?: boolean;
}

export interface DeploymentResult {
    scheduled: number;
    queue: any[];
    packagesToPackageInfo: { [p: string]: PackageInfo };
    deployed: PackageInfo[];
    failed: PackageInfo[];
    error: any;
}
