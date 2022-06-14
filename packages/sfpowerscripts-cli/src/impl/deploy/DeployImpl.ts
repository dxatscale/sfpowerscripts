import ArtifactFetcher, { Artifact } from '@dxatscale/sfpowerscripts.core/lib/artifacts/ArtifactFetcher';
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
import SFPOrg from '@dxatscale/sfpowerscripts.core/lib/org/SFPOrg';
import SfpPackage, { PackageType } from '@dxatscale/sfpowerscripts.core/lib/package/SfpPackage';
import SfpPackageInquirer from '@dxatscale/sfpowerscripts.core/lib/package/SfpPackageInquirer';
import { PostDeployHook } from './PostDeployHook';
import { PreDeployHook } from './PreDeployHook';
import SfpPackageBuilder from '@dxatscale/sfpowerscripts.core/lib/package/SfpPackageBuilder';
import SfpPackageInstaller from '@dxatscale/sfpowerscripts.core/lib/package/SfpPackageInstaller';
import { SfpPackageInstallationOptions } from '@dxatscale/sfpowerscripts.core/lib/package/packageInstallers/InstallPackage';
import * as _ from 'lodash';

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
    isFastFeedbackMode?: boolean;
}

export default class DeployImpl {
    private _postDeployHook: PostDeployHook;
    private _preDeployHook: PreDeployHook;
    private targetOrg: SFPOrg;

    constructor(private props: DeployProps) {}

    public set postDeployHook(hook: PostDeployHook) {
        this._postDeployHook = hook;
    }

    public set preDeployHook(hook: PreDeployHook) {
        this._preDeployHook = hook;
    }

    public async exec(): Promise<DeploymentResult> {
        let deployed: PackageInfo[] = [];
        let failed: PackageInfo[] = [];
        let queue: SfpPackage[];
        let packagesToPackageInfo: { [p: string]: PackageInfo };
        try {
            //Create Org
            this.targetOrg = await SFPOrg.create({ aliasOrUsername: this.props.targetUsername });

            let artifacts = ArtifactFetcher.fetchArtifacts(this.props.artifactDir, null, this.props.packageLogger);

            if (artifacts.length === 0) throw new Error(`No artifacts to deploy found in ${this.props.artifactDir}`);

            //Convert artifacts to SfpPackages
            let sfpPackages = await this.generateSfpPackageFromArtifacts(artifacts);

            //Grab the latest projectConfig from Packages
            let sfpPackageInquirer: SfpPackageInquirer = new SfpPackageInquirer(sfpPackages, this.props.packageLogger);
            let sfdxProjectConfig = sfpPackageInquirer.getLatestProjectConfig();
            if (sfdxProjectConfig == null) {
                // If unable to find latest package manfest in artifacts, use package manifest in project directory
                sfdxProjectConfig = ProjectConfig.getSFDXProjectConfig(null);
            }

            SFPLogger.log('Packages' + sfpPackages.length, LoggerLevel.TRACE, this.props.packageLogger);

            packagesToPackageInfo = await this.getPackagesToPackageInfo(sfpPackages);

            SFPLogger.log(
                'Packages' + JSON.stringify(packagesToPackageInfo),
                LoggerLevel.TRACE,
                this.props.packageLogger
            );

            queue = this.getPackagesToDeploy(sfdxProjectConfig, packagesToPackageInfo);

            SFPLogger.log('queue:' + JSON.stringify(queue), LoggerLevel.TRACE, this.props.packageLogger);

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
                    sfdxProjectConfig,
                    queue,
                    packagesToPackageInfo,
                    this.props.baselineOrg
                );
                SFPLogger.log(
                    'filtered queue:' + JSON.stringify(filteredDeploymentQueue),
                    LoggerLevel.TRACE,
                    this.props.packageLogger
                );
                this.printArtifactVersionsWhenSkipped(queue, packagesToPackageInfo, isBaselinOrgModeActivated);
                queue = filteredDeploymentQueue;
            } else {
                this.printArtifactVersions(queue, packagesToPackageInfo);
            }

            for (let i = 0; i < queue.length; i++) {
                let packageInfo = packagesToPackageInfo[queue[i].packageName];
                let sfpPackage: SfpPackage = packageInfo.sfpPackage;

                let packageType: string = sfpPackage.packageType;

                let pkgDescriptor = ProjectConfig.getPackageDescriptorFromConfig(
                    queue[i].packageName,
                    sfdxProjectConfig
                );

                this.printOpenLoggingGroup('Installing ', queue[i].packageName);
                this.displayHeader(sfpPackage, pkgDescriptor, queue[i].packageName);

                let preHookStatus = await this._preDeployHook?.preDeployPackage(
                    sfpPackage,
                    this.props.targetUsername,
                    this.props.devhubUserName
                );
                if (preHookStatus?.isToFailDeployment) {
                    failed = queue.slice(i).map((pkg) => packagesToPackageInfo[pkg.packageName]);
                    throw new Error(
                        preHookStatus.message
                            ? preHookStatus.message
                            : 'Hook Failed to execute, but didnt provide proper message'
                    );
                }

                let packageInstallationResult: PackageInstallationResult = await retry(
                    async (bail, count) => {
                        try {
                            try {
                                await this.promotePackagesBeforeInstallation(packageInfo.sourceDirectory, sfpPackage);
                            } catch (error) {
                                //skip packages already promoted
                                SFPLogger.log(`Package already prmomoted .. skipping`);
                            }

                            this.displayRetryHeader(this.props.isRetryOnFailure, count);

                            let installPackageResult = await this.installPackage(
                                packageType,
                                queue[i],
                                this.targetOrg,
                                queue[i].packageDescriptor.skipTesting,
                                this.props.waitTime.toString(),
                                pkgDescriptor,
                                false, //Queue already filtered by deploy, there is no further need for individual
                                //commands to decide the skip logic. TODO: fix this incorrect pattern
                                sfpPackage.apiVersion || sfpPackage.payload?.Package?.version // Use package.xml version for backwards compat with old artifacts
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
                    failed = queue.slice(i).map((pkg) => packagesToPackageInfo[pkg.packageName]);
                }

                let postHookStatus = await this._postDeployHook?.postDeployPackage(
                    sfpPackage,
                    packageInstallationResult,
                    this.props.targetUsername,
                    this.props.devhubUserName
                );

                if (postHookStatus?.isToFailDeployment) {
                    failed = queue.slice(i).map((pkg) => packagesToPackageInfo[pkg.packageName]);
                    throw new Error(
                        postHookStatus.message
                            ? postHookStatus.message
                            : 'Hook Failed to execute, but didnt provide proper message'
                    );
                }

                if (packageInstallationResult.result === PackageInstallationStatus.Failed) {
                    failed = queue.slice(i).map((pkg) => packagesToPackageInfo[pkg.packageName]);
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
    private async generateSfpPackageFromArtifacts(artifacts: Artifact[]): Promise<SfpPackage[]> {
        let sfpPackages: SfpPackage[] = [];
        for (const artifact of artifacts) {
            let sfpPackage = await SfpPackageBuilder.buildPackageFromArtifact(artifact, this.props.packageLogger);
            sfpPackages.push(sfpPackage);
        }
        return sfpPackages;
    }

    private async promotePackagesBeforeInstallation(sourceDirectory: string, sfpPackage: SfpPackage) {
        if (this.props.promotePackagesBeforeDeploymentToOrg === this.props.targetUsername) {
            if (sfpPackage.packageType === PackageType.Unlocked) {
                console.log(
                    COLOR_KEY_MESSAGE(`Attempting to promote package ${sfpPackage.packageName} before installation`)
                );
                let promoteUnlockedPackageImpl: PromoteUnlockedPackageImpl = new PromoteUnlockedPackageImpl(
                    sourceDirectory,
                    sfpPackage.package_version_id,
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

    private displayHeader(sfpPackage: SfpPackage, pkgDescriptor: any, pkg: string) {
        let alwaysDeployMessage: string;

        if (this.props.skipIfPackageInstalled) {
            if (pkgDescriptor.alwaysDeploy) alwaysDeployMessage = `Always Deploy: ${COLOR_KEY_MESSAGE(`True`)}`;
            else alwaysDeployMessage = `Always Deploy: ${COLOR_KEY_MESSAGE(`False`)}`;
        } else alwaysDeployMessage = undefined;

        //Display header
        SFPLogger.log(
            COLOR_HEADER(
                `----------------------------------Installing Package---------------------------------------------`
            ),
            LoggerLevel.INFO,
            this.props.packageLogger
        );
        SFPLogger.log(COLOR_HEADER(`Name: ${COLOR_KEY_MESSAGE(pkg)}`), LoggerLevel.INFO, this.props.packageLogger);
        SFPLogger.log(`Type: ${COLOR_KEY_MESSAGE(sfpPackage.packageType)}`, LoggerLevel.INFO, this.props.packageLogger);
        SFPLogger.log(
            `Version Number: ${COLOR_KEY_MESSAGE(sfpPackage.versionNumber)}`,
            LoggerLevel.INFO,
            this.props.packageLogger
        );
        this.displayTestInfoHeader(sfpPackage);
        if (pkgDescriptor.aliasfy)
            SFPLogger.log(
                `Aliasified Package: ${COLOR_KEY_MESSAGE(`True`)}`,
                LoggerLevel.INFO,
                this.props.packageLogger
            );
        SFPLogger.log(
            `Contains Apex Classes/Triggers: ${COLOR_KEY_MESSAGE(sfpPackage.isApexFound)}`,
            LoggerLevel.INFO,
            this.props.packageLogger
        );
        if (sfpPackage.packageType == PackageType.Source || sfpPackage.packageType == PackageType.Unlocked) {
            if (!pkgDescriptor.aliasfy) {
                if (this.props.isFastFeedbackMode && sfpPackage.diffPackageMetadata?.metadataCount)
                    SFPLogger.log(
                        `Metadata to be deployed: ${COLOR_KEY_MESSAGE(
                            sfpPackage.diffPackageMetadata?.metadataCount
                        )} / ${COLOR_KEY_MESSAGE(sfpPackage.metadataCount)}`,
                        LoggerLevel.INFO,
                        this.props.packageLogger
                    );
                else
                    SFPLogger.log(
                        `Metadata to be deployed: ${COLOR_KEY_MESSAGE(sfpPackage.metadataCount)}`,
                        LoggerLevel.INFO,
                        this.props.packageLogger
                    );
            }
        }
        if (alwaysDeployMessage) SFPLogger.log(alwaysDeployMessage, LoggerLevel.INFO, this.props.packageLogger);

        SFPLogger.log(
            COLOR_HEADER(
                `-------------------------------------------------------------------------------------------------`
            ),
            LoggerLevel.INFO,
            this.props.packageLogger
        );
    }

    private displayTestInfoHeader(sfpPackage: SfpPackage) {
        if (sfpPackage.packageType == PackageType.Source) {
            if (!sfpPackage.isTriggerAllTests)
                SFPLogger.log(
                    `Optimized Deployment: ${COLOR_KEY_MESSAGE(
                        this.isOptimizedDeploymentForSourcePackage(sfpPackage.packageDescriptor)
                    )}`,
                    LoggerLevel.INFO,
                    this.props.packageLogger
                );
            else
                SFPLogger.log(
                    `Trigger All Tests: ${COLOR_KEY_MESSAGE(`true`)}`,
                    LoggerLevel.INFO,
                    this.props.packageLogger
                );
        }
    }

    private printArtifactVersionsWhenSkipped(
        queue: SfpPackage[],
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
                pkg.packageName,
                pkg.versionNumber,
                packagesToPackageInfo[pkg.packageName].versionInstalledInOrg
                    ? packagesToPackageInfo[pkg.packageName].versionInstalledInOrg
                    : 'N/A',
                packagesToPackageInfo[pkg.packageName].isPackageInstalled ? 'No' : 'Yes',
            ]);
        });
        SFPLogger.log(maxTable.toString(), LoggerLevel.INFO, this.props.packageLogger);
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
            if (!packagesToPackageInfo[pkg.packageName].isPackageInstalled)
                minTable.push([
                    pkg.packageName,
                    pkg.versionNumber,
                    packagesToPackageInfo[pkg.packageName].versionInstalledInOrg
                        ? packagesToPackageInfo[pkg.packageName].versionInstalledInOrg
                        : 'N/A',
                ]);
        });
        SFPLogger.log(minTable.toString(), LoggerLevel.INFO, this.props.packageLogger);
        this.printClosingLoggingGroup();
    }

    private printArtifactVersions(queue: SfpPackage[], packagesToPackageInfo: { [p: string]: PackageInfo }) {
        this.printOpenLoggingGroup(`Packages to be deployed`);
        let table = new Table({
            head: ['Package', 'Version to be installed'],
        });

        queue.forEach((pkg) => {
            table.push([pkg.packageName, pkg.versionNumber]);
        });
        SFPLogger.log(table.toString(), LoggerLevel.INFO, this.props.packageLogger);
        this.printClosingLoggingGroup();
    }

    private async filterByPackagesInstalledInTheOrg(
        packageManifest: any,
        queue: SfpPackage[],
        packagesToPackageInfo: { [p: string]: PackageInfo },
        targetUsername: string
    ): Promise<any[]> {
        let targetOrg = await SFPOrg.create({ aliasOrUsername: targetUsername });

        const clonedQueue = _.clone(queue);

        for (let i = queue.length - 1; i >= 0; i--) {
            let packageInfo = packagesToPackageInfo[clonedQueue[i].packageName];
            let sfpPackage: SfpPackage = packageInfo.sfpPackage;
            let pkgDescriptor = ProjectConfig.getPackageDescriptorFromConfig(
                clonedQueue[i].packageName,
                packageManifest
            );
            let packageInstalledInTheOrg = await targetOrg.isArtifactInstalledInOrg(
                this.props.packageLogger,
                sfpPackage
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
    private async getPackagesToPackageInfo(sfpPackages: SfpPackage[]): Promise<{ [p: string]: PackageInfo }> {
        let packagesToPackageInfo: { [p: string]: PackageInfo } = {};

        for (let sfpPackage of sfpPackages) {
            if (packagesToPackageInfo[sfpPackage.packageName]) {
                let previousVersionNumber = this.convertBuildNumDotDelimToHyphen(
                    packagesToPackageInfo[sfpPackage.packageName].sfpPackage.versionNumber
                );
                let currentVersionNumber = this.convertBuildNumDotDelimToHyphen(sfpPackage.versionNumber);

                // replace existing packageInfo if package version number is newer
                if (semver.gt(currentVersionNumber, previousVersionNumber)) {
                    packagesToPackageInfo[sfpPackage.packageName] = {
                        sourceDirectory: sfpPackage.sourceDir,
                        sfpPackage: sfpPackage,
                    };
                }
            } else {
                packagesToPackageInfo[sfpPackage.packageName] = {
                    sourceDirectory: sfpPackage.sourceDir,
                    sfpPackage: sfpPackage,
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
        sfpPackage: SfpPackage,
        targetOrg: SFPOrg,
        skipTesting: boolean,
        waitTime: string,
        pkgDescriptor: any,
        skipIfPackageInstalled: boolean,
        apiVersion: string
    ): Promise<PackageInstallationResult> {
        //Compute Deployment Type
        let deploymentType =
            this.props.deploymentMode === DeploymentMode.SOURCEPACKAGES_PUSH
                ? DeploymentType.SOURCE_PUSH
                : this.props.isFastFeedbackMode
                ? DeploymentType.SELECTIVE_MDAPI_DEPLOY
                : DeploymentType.MDAPI_DEPLOY;

        //Add Installation Options
        let installationOptions = new SfpPackageInstallationOptions();
        (installationOptions.installationkey = null), (installationOptions.apexcompile = 'package');
        installationOptions.securitytype = 'AdminsOnly';
        installationOptions.upgradetype = 'Mixed';
        installationOptions.waitTime = waitTime;
        installationOptions.apiVersion = apiVersion;
        installationOptions.publishWaitTime = 60;
        installationOptions.isInstallingForValidation =
            this.props.currentStage === 'prepare' || this.props.currentStage === 'validate';
        (installationOptions.optimizeDeployment = this.isOptimizedDeploymentForSourcePackage(pkgDescriptor)),
            (installationOptions.skipTesting = skipTesting),
            (installationOptions.deploymentType = deploymentType);


    //During validate, if optimizeDeploymentMode is false, use full local tests to validate
    //During Prepare (push), dont trigger tests
        if (this.props.deploymentMode === DeploymentMode.SOURCEPACKAGES) {
            if (!this.isOptimizedDeploymentForSourcePackage(pkgDescriptor)) {
                installationOptions.optimizeDeployment = false;
                installationOptions.skipTesting = false;
            } else {
                installationOptions.optimizeDeployment = false;
                installationOptions.skipTesting = true;
            }
        } else if (this.props.deploymentMode === DeploymentMode.SOURCEPACKAGES_PUSH) {
            installationOptions.optimizeDeployment = false;
            installationOptions.skipTesting = true;
        }

        installationOptions.skipIfPackageInstalled = skipIfPackageInstalled;
        installationOptions.isDryRun = this.props.isDryRun;

        return SfpPackageInstaller.installPackage(
            this.props.packageLogger,
            sfpPackage,
            targetOrg,
            installationOptions,
            {
                currentStage: this.props.currentStage,
            },
            sfpPackage.packageType == PackageType.Unlocked && installationOptions.isInstallingForValidation
                ? PackageType.Source
                : undefined //Override to source
        );
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
    private getPackagesToDeploy(
        sfdxProjectConfig: any,
        packagesToPackageInfo: { [p: string]: PackageInfo }
    ): SfpPackage[] {
        let packagesToDeploy: SfpPackage[] = [];

        let packages = sfdxProjectConfig['packageDirectories'];

        // Filter package manifest by whats available in artifacts
        for (const pkg of packages) {
            if (packagesToPackageInfo[pkg.package])
                packagesToDeploy.push(packagesToPackageInfo[pkg.package].sfpPackage);
        }

        // Filter out packages that are to be skipped on the target org
        packagesToDeploy = packagesToDeploy.filter(
            (sfpPackage) => !this.isSkipDeployment(sfpPackage.packageDescriptor, this.props.targetUsername)
        );

        //Ignore packages based on stage
        packagesToDeploy = packagesToDeploy.filter((pkg) => {
            if (
                pkg.packageDescriptor.ignoreOnStage?.find((stage) => {
                    stage = stage.toLowerCase();
                    return stage === this.props.currentStage;
                })
            )
                return false;
            else return true;
        });

        if (packagesToDeploy.length === 0) throw new Error(`No artifacts from project config to be deployed`);
        else return packagesToDeploy;
    }
}

export interface PackageInfo {
    sourceDirectory: string;
    sfpPackage: SfpPackage;
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
