import ArtifactFetcher, { Artifact } from '@dxatscale/sfpowerscripts.core/lib/artifacts/ArtifactFetcher';
import SFPLogger, { COLOR_ERROR, COLOR_SUCCESS, FileLogger, Logger, LoggerLevel } from '@dxatscale/sfp-logger';
import { EOL } from 'os';
import { Stage } from '../Stage';
import ProjectConfig from '@dxatscale/sfpowerscripts.core/lib/project/ProjectConfig';
import semver = require('semver');
import PromoteUnlockedPackageImpl from '@dxatscale/sfpowerscripts.core/lib/package/promote/PromoteUnlockedPackageImpl';
import { DeploymentType } from '@dxatscale/sfpowerscripts.core/lib/deployers/DeploymentExecutor';
import { COLOR_KEY_MESSAGE,COLOR_KEY_VALUE,COLOR_HEADER } from '@dxatscale/sfp-logger';
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
import GroupConsoleLogs from '../../ui/GroupConsoleLogs';
import { ZERO_BORDER_TABLE } from '../../ui/TableConstants';
import convertBuildNumDotDelimToHyphen from '@dxatscale/sfpowerscripts.core/lib/utils/VersionNumberConverter';
import ReleaseConfig from '../release/ReleaseConfig';
import fs from 'fs-extra';
import { Align, getMarkdownTable } from 'markdown-table-ts';
import FileOutputHandler from '../../outputs/FileOutputHandler';
import { ReleaseStreamService } from '@dxatscale/sfpowerscripts.core/lib/eventStream/release';


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
    logger?: Logger;
    currentStage?: Stage;
    baselineOrg?: string;
    isDryRun?: boolean;
    isRetryOnFailure?: boolean;
    promotePackagesBeforeDeploymentToOrg?: string;
    devhubUserName?: string;
    disableArtifactCommit?: boolean;
    selectiveComponentDeployment?: boolean;
    maxRetryCount?:number;
    releaseConfigPath?:string;
}

export default class DeployImpl {
    private _postDeployHook: PostDeployHook;
    private _preDeployHook: PreDeployHook;
    private targetOrg: SFPOrg;

    constructor(private props: DeployProps) {

        //Set defaults
        if(!this.props.maxRetryCount)
         this.props.maxRetryCount = 1;
    }

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

            let artifacts = ArtifactFetcher.fetchArtifacts(this.props.artifactDir, null, this.props.logger);

            if (artifacts.length === 0) throw new Error(`No artifacts to deploy found in ${this.props.artifactDir}`);

            //Convert artifacts to SfpPackages
            let sfpPackages = await this.generateSfpPackageFromArtifacts(artifacts);



            //Filter artifacts based on release config
            sfpPackages = this.filterSfPPackagesBasedOnReleaseConfig(sfpPackages,this.props.releaseConfigPath,this.props.logger);

            //Grab the latest projectConfig from Packages
            let sfpPackageInquirer: SfpPackageInquirer = new SfpPackageInquirer(sfpPackages, this.props.logger);
            let sfdxProjectConfig = sfpPackageInquirer.getLatestProjectConfig();
            if (sfdxProjectConfig == null) {
                // If unable to find latest package manifest in artifacts, use package manifest in project directory
                sfdxProjectConfig = ProjectConfig.getSFDXProjectConfig(null);
            }

            SFPLogger.log('Packages' + sfpPackages.length, LoggerLevel.TRACE, this.props.logger);

            packagesToPackageInfo = await this.getPackagesToPackageInfo(sfpPackages);

            SFPLogger.log(
                'Packages' + JSON.stringify(packagesToPackageInfo),
                LoggerLevel.TRACE,
                this.props.logger
            );

            queue = this.getPackagesToDeploy(sfdxProjectConfig, packagesToPackageInfo);

            SFPLogger.log('queue:' + JSON.stringify(queue), LoggerLevel.TRACE, this.props.logger);

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
                    this.props.logger
                );
                this.printArtifactVersionsWhenSkipped(queue, packagesToPackageInfo, isBaselinOrgModeActivated,this.props);
                queue = filteredDeploymentQueue;
            } else {
                this.printArtifactVersions(queue, packagesToPackageInfo);
            }

            for (let i = 0; i < queue.length; i++) {
                let packageInfo = packagesToPackageInfo[queue[i].packageName];
                let sfpPackage: SfpPackage = packageInfo.sfpPackage;
                ReleaseStreamService.buildStatusProgress(sfpPackage);

                let packageType: string = sfpPackage.packageType;

                let pkgDescriptor = ProjectConfig.getPackageDescriptorFromConfig(
                    queue[i].packageName,
                    sfdxProjectConfig
                );

                let groupSection;
                if (this.props.currentStage == Stage.VALIDATE) {
                    groupSection = new GroupConsoleLogs(
                        `Validating: ${i + 1}/${queue.length}  ${queue[i].packageName}`,
                        this.props.logger
                    ).begin();
                } else
                    groupSection = new GroupConsoleLogs(
                        `Installing: ${i + 1}/${queue.length}  ${queue[i].packageName}`,
                        this.props.logger
                    ).begin();

                //Display Header
                this.displayHeader(sfpPackage, pkgDescriptor, queue[i].packageName);

                let preHookStatus = await this._preDeployHook?.preDeployPackage(
                    sfpPackage,
                    this.props.targetUsername,
                    sfpPackages,
                    this.props.devhubUserName,
                    this.props.logger
                );
                if (preHookStatus?.isToFailDeployment) {
                    ReleaseStreamService.buildDeployErrorsPkg(sfpPackage.packageName);
                    failed = queue.slice(i).map((pkg) => {
                        ReleaseStreamService.sendPackageError(
                            pkg.packageName,
                            preHookStatus.message
                                ? preHookStatus.message
                                : 'Hook Failed to execute, but didnt provide proper message'
                        );
                        return packagesToPackageInfo[pkg.packageName];
                        });
                    throw new Error(
                        preHookStatus.message
                            ? preHookStatus.message
                            : 'Hook Failed to execute, but didnt provide proper message'
                    );
                }

                let isToBeRetried: boolean = this.props.isRetryOnFailure;
                let packageInstallationResult: PackageInstallationResult = await retry(
                    async (bail, attemptCount) => {
                        try {
                            try {
                                await this.promotePackagesBeforeInstallation(packageInfo.sourceDirectory, sfpPackage);
                            } catch (error) {
                                //skip packages already promoted
                                SFPLogger.log(`Package already promoted .. skipping`,LoggerLevel.WARN);
                            }

                            this.displayRetryHeader(isToBeRetried, attemptCount);

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

                            //Handle specific error condition which need a retry, overriding the set value
                            isToBeRetried = handleRetryOnSpecificConditions(isToBeRetried, installPackageResult, attemptCount,this.props.maxRetryCount);

                            if (isToBeRetried) {
                                throw new Error(installPackageResult.message);
                            } else return installPackageResult;
                        } catch (error) {
                            if (isToBeRetried) {
                                throw error;
                            } else {
                                // Any other exception, in regular cases dont retry, just bail out
                                let failedPackageInstallationResult: PackageInstallationResult = {
                                    result: PackageInstallationStatus.Failed,
                                    message: error,
                                };


                                FileOutputHandler.getInstance().writeOutput(`deployment-error.md`,`### 💣 Deployment Failed  💣`);
                                FileOutputHandler.getInstance().appendOutput(`deployment-error.md`,`Package Installation failed for  **${queue[i].packageName}**`);
                                FileOutputHandler.getInstance().appendOutput(`deployment-error.md`,`Reasons:`);
                                FileOutputHandler.getInstance().appendOutput(`deployment-error.md`,`${error}`);

                                return failedPackageInstallationResult;
                            }
                        }

                        function handleRetryOnSpecificConditions(
                            isToBeRetried: boolean,
                            installPackageResult: PackageInstallationResult,
                            retryCount: number,
                            maxRetryCount:number
                        ): boolean {
                            //override current value when encountering such issue
                            if (installPackageResult.result === PackageInstallationStatus.Failed) {
                                if (installPackageResult.message?.includes('ongoing background job'))
                                    return true;
                                else if (isToBeRetried && retryCount <= maxRetryCount )
                                   return true;
                                else
                                   return false;
                            } else return false;
                        }
                    },
                    { retries: 10, minTimeout: 30000 }
                );

                if (packageInstallationResult.result === PackageInstallationStatus.Succeeded) {
                    deployed.push(packageInfo);
                } else if (packageInstallationResult.result === PackageInstallationStatus.Skipped) {
                    continue;
                } else if (packageInstallationResult.result === PackageInstallationStatus.Failed) {
                    ReleaseStreamService.buildDeployErrorsPkg(sfpPackage.packageName);
                    failed = queue.slice(i).map((pkg) => {
                       return packagesToPackageInfo[pkg.packageName]
                    });
                }

                // Only deploy post hook when package installation is successful
                if(packageInstallationResult.result === PackageInstallationStatus.Succeeded) {
                    let postHookStatus = await this._postDeployHook?.postDeployPackage(
                        sfpPackage,
                        packageInstallationResult,
                        this.props.targetUsername,
                        sfpPackages,
                        this.props.devhubUserName,
                        this.props.logger
                    );

                    if (postHookStatus?.isToFailDeployment) {
                        ReleaseStreamService.buildDeployErrorsPkg(sfpPackage.packageName);
                        failed = queue.slice(i).map((pkg) => {
                            ReleaseStreamService.sendPackageError(
                                pkg.packageName,
                                postHookStatus.message
                                    ? postHookStatus.message
                                    : 'Hook Failed to execute, but didnt provide proper message'
                            );
                            return packagesToPackageInfo[pkg.packageName];
                        });
                        throw new Error(
                            postHookStatus.message
                                ? postHookStatus.message
                                : 'Hook Failed to execute, but didnt provide proper message'
                        );
                    }
                }

                if (packageInstallationResult.result === PackageInstallationStatus.Failed) {
                    ReleaseStreamService.buildDeployErrorsPkg(sfpPackage.packageName);
                    failed = queue.slice(i).map((pkg) => {
                        ReleaseStreamService.sendPackageError(pkg.packageName, packageInstallationResult.message);
                        return packagesToPackageInfo[pkg.packageName]
                    });
                    throw new Error(packageInstallationResult.message);
                }

                ReleaseStreamService.sendPackageSuccess(packageInfo.sfpPackage);

                groupSection.end();
            }

            return {
                scheduled: queue.length,
                deployed: deployed,
                failed: failed,
                queue: queue,
                packagesToPackageInfo: packagesToPackageInfo,
                error: null
            };
        } catch (err) {
            SFPLogger.log(err, LoggerLevel.ERROR, this.props.logger);

            return {
                scheduled: queue?.length ? queue.length : 0,
                deployed: deployed,
                failed: failed,
                queue: queue,
                packagesToPackageInfo: packagesToPackageInfo,
                error: err.message,
            };
        }
    }
    private filterSfPPackagesBasedOnReleaseConfig(sfpPackages: SfpPackage[], releaseConfigPath: string,logger:Logger): SfpPackage[] {
       if(!releaseConfigPath)
       return sfpPackages;
       else
       {
          SFPLogger.log(COLOR_KEY_MESSAGE(`Filtering packages to be deployed based on release config ${COLOR_KEY_VALUE(releaseConfigPath)}`),LoggerLevel.INFO,logger);
          let releaseConfig:ReleaseConfig = new ReleaseConfig(logger,releaseConfigPath);
          let packages = releaseConfig.getPackagesAsPerReleaseConfig();
          //Filter artifacts based on packages
            let filteredSfPPackages:SfpPackage[] = [];

            for (const sfpPackage of sfpPackages) {
                if (packages.includes(sfpPackage.packageName)) {
                    filteredSfPPackages.push(sfpPackage);
                }
             }
         return filteredSfPPackages;
       }

    }


    private async generateSfpPackageFromArtifacts(artifacts: Artifact[]): Promise<SfpPackage[]> {
        let sfpPackages: SfpPackage[] = [];
        for (const artifact of artifacts) {
            let sfpPackage = await SfpPackageBuilder.buildPackageFromArtifact(artifact, this.props.logger);
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
                if(!this.props.isDryRun)
                {
                    let promoteUnlockedPackageImpl: PromoteUnlockedPackageImpl = new PromoteUnlockedPackageImpl(
                        sourceDirectory,
                        sfpPackage.package_version_id,
                        this.props.devhubUserName
                    );
                    await promoteUnlockedPackageImpl.promote();
                }
            }
        }
    }

    private displayRetryHeader(isRetryOnFailure: boolean, count: number) {
        if (isRetryOnFailure && count > 1) {
            SFPLogger.printHeaderLine('',COLOR_HEADER,LoggerLevel.INFO);
            SFPLogger.log(`Retrying On Failure Attempt: ${count}`, LoggerLevel.INFO, this.props.logger);
            SFPLogger.printHeaderLine('',COLOR_HEADER,LoggerLevel.INFO);
        }
    }

    private displayHeader(sfpPackage: SfpPackage, pkgDescriptor: any, pkg: string) {
        let alwaysDeployMessage: string;

        if (this.props.skipIfPackageInstalled) {
            if (pkgDescriptor.alwaysDeploy) alwaysDeployMessage = `Always Deploy: ${COLOR_KEY_MESSAGE(`True`)}`;
            else alwaysDeployMessage = `Always Deploy: ${COLOR_KEY_MESSAGE(`False`)}`;
        } else alwaysDeployMessage = undefined;

        //Display header
        SFPLogger.printHeaderLine('Installing Package',COLOR_HEADER,LoggerLevel.INFO);
        SFPLogger.log(COLOR_HEADER(`Name: ${COLOR_KEY_MESSAGE(pkg)}`), LoggerLevel.INFO, this.props.logger);
        SFPLogger.log(`Type: ${COLOR_KEY_MESSAGE(sfpPackage.packageType)}`, LoggerLevel.INFO, this.props.logger);
        SFPLogger.log(
            `Version Number: ${COLOR_KEY_MESSAGE(sfpPackage.versionNumber)}`,
            LoggerLevel.INFO,
            this.props.logger
        );
        this.displayTestInfoHeader(sfpPackage);
        if (pkgDescriptor.aliasfy)
            SFPLogger.log(
                `Aliasified Package: ${COLOR_KEY_MESSAGE(`True`)}`,
                LoggerLevel.INFO,
                this.props.logger
            );
        if(sfpPackage.isApexFound)
            SFPLogger.log(
                `Contains Apex Classes/Triggers: ${COLOR_KEY_MESSAGE(sfpPackage.isApexFound)}`,
                LoggerLevel.INFO,
                this.props.logger
            );
        if (sfpPackage.packageType == PackageType.Source || sfpPackage.packageType == PackageType.Unlocked) {
            if (!pkgDescriptor.aliasfy) {
                    SFPLogger.log(
                        `Metadata to be deployed: ${COLOR_KEY_MESSAGE(sfpPackage.metadataCount)}`,
                        LoggerLevel.INFO,
                        this.props.logger
                    );
            }
        }

        if (pkgDescriptor.skipTesting) {
            SFPLogger.log(
                `Skip Testing: ${COLOR_KEY_MESSAGE(pkgDescriptor.skipTesting ? 'true' : 'false')}`,
                LoggerLevel.INFO,
                this.props.logger
            );
        }

        if (alwaysDeployMessage) SFPLogger.log(alwaysDeployMessage, LoggerLevel.INFO, this.props.logger);
        SFPLogger.printHeaderLine('',COLOR_HEADER,LoggerLevel.INFO);
    }

    private displayTestInfoHeader(sfpPackage: SfpPackage) {
        if (sfpPackage.packageType == PackageType.Source) {
            if (!sfpPackage.isTriggerAllTests)
                SFPLogger.log(
                    `Optimized Deployment: ${COLOR_KEY_MESSAGE(
                        this.isOptimizedDeploymentForSourcePackage(sfpPackage.packageDescriptor)
                    )}`,
                    LoggerLevel.INFO,
                    this.props.logger
                );
            else
                SFPLogger.log(
                    `Trigger All Tests: ${COLOR_KEY_MESSAGE(`true`)}`,
                    LoggerLevel.INFO,
                    this.props.logger
                );
        }
    }

    private printArtifactVersionsWhenSkipped(
        queue: SfpPackage[],
        packagesToPackageInfo: { [p: string]: PackageInfo },
        isBaselinOrgModeActivated: boolean,
        props:DeployProps
    ) {
        let groupSection = new GroupConsoleLogs(`Full Deployment Breakdown`, this.props.logger).begin();
        let maxTable = new Table({
            head: [
                'Package',
                'Incoming Version',
                isBaselinOrgModeActivated ? 'Version in baseline org' : 'Version in org',
                'To be installed?',
            ],
            chars: ZERO_BORDER_TABLE,
        });

        queue.forEach((pkg) => {
            maxTable.push(processColoursForAllPackages(pkg));
        });

        SFPLogger.log(maxTable.toString(), LoggerLevel.INFO, this.props.logger);


        //Insane Hack
        //TODO: Export the value to the caller
        printDeploymentBreakDownInMarkdown();

        groupSection.end();

        groupSection = new GroupConsoleLogs(`Packages to be deployed`, this.props.logger).begin();
        let minTable = new Table({
            head: [
                'Package',
                'Incoming Version',
                isBaselinOrgModeActivated ? 'Version in baseline org' : 'Version in org',
            ],
            chars: ZERO_BORDER_TABLE,
        });

        queue.forEach((pkg) => {
            if (!packagesToPackageInfo[pkg.packageName].isPackageInstalled){
                minTable.push([
                    COLOR_KEY_MESSAGE(pkg.packageName),
                    COLOR_KEY_MESSAGE(pkg.versionNumber),
                    packagesToPackageInfo[pkg.packageName].versionInstalledInOrg
                        ? COLOR_KEY_MESSAGE(packagesToPackageInfo[pkg.packageName].versionInstalledInOrg)
                        : COLOR_KEY_MESSAGE('N/A'),
                ]);
                ReleaseStreamService.buildPackageInitialitation(
                    pkg.packageName,
                    pkg.versionNumber,
                    packagesToPackageInfo[pkg.packageName].versionInstalledInOrg
                        ? COLOR_KEY_MESSAGE(packagesToPackageInfo[pkg.packageName].versionInstalledInOrg)
                        : COLOR_KEY_MESSAGE('N/A'),
                    pkg.package_type
                );
            }
        });
        SFPLogger.log(minTable.toString(), LoggerLevel.INFO, this.props.logger);
        groupSection.end();



        function printDeploymentBreakDownInMarkdown() {
            let tableData = {
                table: {
                    head:  [
                        'Package',
                        'Incoming Version',
                         isBaselinOrgModeActivated ? 'Version in baseline org' : 'Version in org',
                        'To be installed?',
                        'Promotion Status'
                    ],
                    body: []
                },
                alignment: [Align.Left, Align.Left, Align.Left,Align.Right],
            };
            for (const pkg of queue) {
                tableData.table.body.push(getRowForMarkdownTable(pkg,props));
            }
            const table = getMarkdownTable(tableData);
            const outputHandler:FileOutputHandler = FileOutputHandler.getInstance();
            outputHandler.writeOutput('deployment-breakdown.md',table) ;
        }

        function processColoursForAllPackages(pkg) {
            const pkgInfo = packagesToPackageInfo[pkg.packageName];

            let packageName = pkg.packageName;
            let versionNumber = pkg.versionNumber;
            let versionInstalledInOrg = pkgInfo.versionInstalledInOrg ? pkgInfo.versionInstalledInOrg : 'N/A';
            let isPackageInstalled = pkgInfo.isPackageInstalled ? 'No' : 'Yes';

            if (pkgInfo.isPackageInstalled) {
              packageName = COLOR_SUCCESS(packageName);
              versionNumber = COLOR_SUCCESS(versionNumber);
              versionInstalledInOrg = COLOR_SUCCESS(versionInstalledInOrg);
              isPackageInstalled = COLOR_SUCCESS(isPackageInstalled);
            }
            else
            {
                packageName = COLOR_ERROR(packageName);
                versionNumber = COLOR_ERROR(versionNumber);
                versionInstalledInOrg = COLOR_ERROR(versionInstalledInOrg);
                isPackageInstalled = COLOR_ERROR(isPackageInstalled);

            }

            return [packageName, versionNumber, versionInstalledInOrg, isPackageInstalled];
        }


        function getRowForMarkdownTable(pkg:SfpPackage, props:DeployProps) {
            const pkgInfo = packagesToPackageInfo[pkg.packageName];

            let packageName = pkg.packageName;
            let versionNumber = pkg.versionNumber;
            let versionInstalledInOrg = pkgInfo.versionInstalledInOrg ? pkgInfo.versionInstalledInOrg : 'N/A';
            let isPackageToBeInstalled = pkgInfo.isPackageInstalled ? 'No' : 'Yes';
            let promotionStatus = 'N/A';

            if(isPackageToBeInstalled=="Yes")
            {
                isPackageToBeInstalled = `![Yes](https://img.shields.io/badge/Yes-green.svg)`;
                packageName = `**${packageName}**`;
                if(pkg.packageType==PackageType.Unlocked)
                {
                    if (props.promotePackagesBeforeDeploymentToOrg == props.targetUsername && versionInstalledInOrg == "N/A") {
                        promotionStatus = '![Pending](https://img.shields.io/badge/Pending-yellow.svg)';
                    }
                    else if(props.promotePackagesBeforeDeploymentToOrg == props.targetUsername  ) {
                        let versionInstalledInOrgConvertedToSemver = convertBuildNumDotDelimToHyphen(versionInstalledInOrg);
                        let versionNumberConvertedToSemver = convertBuildNumDotDelimToHyphen(versionNumber);
                        if (semver.diff(versionInstalledInOrgConvertedToSemver, versionNumberConvertedToSemver) == 'prerelease') {
                            promotionStatus = '![Already Promoted](https://img.shields.io/badge/Already%20Promoted-red.svg)';
                        }
                        else {
                            promotionStatus = '![Pending](https://img.shields.io/badge/Pending-yellow.svg)';
                        }
                    }
                    else
                    {
                        promotionStatus = 'N/A';
                    }
                }

            versionNumber = `**${versionNumber}**`;
            versionInstalledInOrg = `**${versionInstalledInOrg}**`;
            }
            else
            {
                versionNumber = `**${versionNumber}**`;
                versionInstalledInOrg = `**${versionInstalledInOrg}**`;
            }

            return [packageName, versionNumber, versionInstalledInOrg, isPackageToBeInstalled,promotionStatus];
          }
    }

    private printArtifactVersions(queue: SfpPackage[], packagesToPackageInfo: { [p: string]: PackageInfo }) {
        let groupSection = new GroupConsoleLogs(`Packages to be deployed`, this.props.logger).begin();
        let table = new Table({
            head: ['Package', 'Version to be installed'],
            chars: ZERO_BORDER_TABLE,
        });

        queue.forEach((pkg) => {
            table.push([pkg.packageName, pkg.versionNumber]);
            ReleaseStreamService.buildPackageInitialitation(
                pkg.packageName,
                pkg.versionNumber,
                'N/A',
                pkg.package_type
            );
        });
        SFPLogger.log(table.toString(), LoggerLevel.INFO, this.props.logger);
        groupSection.end();

        printDeploymentBreakDownInMarkdown();


        function printDeploymentBreakDownInMarkdown() {
            let tableData = {
                table: {
                    head:  [
                        'Package',
                        'Version to be installed'
                    ],
                    body: []
                },
                alignment: [Align.Left, Align.Left, Align.Left,Align.Right],
            };
            for (const pkg of queue) {
                tableData.table.body.push(getRowForMarkdownTable(pkg));
            }

            const outputHandler:FileOutputHandler = FileOutputHandler.getInstance();
            outputHandler.writeOutput('deployment-breakdown.md',`Please find the packages that will be deployed below`);
            outputHandler.appendOutput('deployment-breakdown.md',`\n\n${getMarkdownTable(tableData)}`) ;
        }

        function getRowForMarkdownTable(pkg:SfpPackage) {
            let packageName = pkg.packageName;
            let versionNumber = pkg.versionNumber;
            return [packageName, versionNumber];
          }
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
                this.props.logger,
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

    /**
     * Returns map of package name to package info
     * @param artifacts
     */
    private async getPackagesToPackageInfo(sfpPackages: SfpPackage[]): Promise<{ [p: string]: PackageInfo }> {
        let packagesToPackageInfo: { [p: string]: PackageInfo } = {};

        for (let sfpPackage of sfpPackages) {
            if (packagesToPackageInfo[sfpPackage.packageName]) {
                let previousVersionNumber = convertBuildNumDotDelimToHyphen(
                    packagesToPackageInfo[sfpPackage.packageName].sfpPackage.versionNumber
                );
                let currentVersionNumber = convertBuildNumDotDelimToHyphen(sfpPackage.versionNumber);

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
                ? DeploymentType.SOURCE_PUSH : DeploymentType.MDAPI_DEPLOY;

        //Add Installation Options
        let installationOptions = new SfpPackageInstallationOptions();
        installationOptions.installationkey = null,
        installationOptions.apexcompile = 'package';
        installationOptions.waitTime = waitTime;
        installationOptions.apiVersion = apiVersion;
        installationOptions.publishWaitTime = 60;
        installationOptions.isInstallingForValidation =
            this.props.deploymentMode != DeploymentMode.NORMAL &&
            (this.props.currentStage === Stage.PREPARE || this.props.currentStage === Stage.VALIDATE);
        installationOptions.optimizeDeployment = this.isOptimizedDeploymentForSourcePackage(pkgDescriptor);
        installationOptions.skipTesting = skipTesting;
        installationOptions.deploymentType = deploymentType;
        installationOptions.disableArtifactCommit = this.props.disableArtifactCommit;

        //During validate, if optimizeDeploymentMode is false, use full local tests to validate
        //but respect skipTesting #issue 1075
        //During Prepare (push), dont trigger tests
        if (this.props.currentStage == Stage.VALIDATE) {
            //Always enable skipTest as the default installation option during validate
            //as test are run subsequently
            installationOptions.skipTesting = true;
            if (!this.isOptimizedDeploymentForSourcePackage(pkgDescriptor)) {
                if (sfpPackage.packageDescriptor.skipTesting)
                    installationOptions.skipTesting = sfpPackage.packageDescriptor.skipTesting;
                else installationOptions.skipTesting = false;
            }
        } else if (this.props.currentStage === Stage.PREPARE) {
            installationOptions.optimizeDeployment = false;
            installationOptions.skipTesting = true;
        }

        installationOptions.skipIfPackageInstalled = skipIfPackageInstalled;
        installationOptions.isDryRun = this.props.isDryRun;

        return SfpPackageInstaller.installPackage(
            this.props.logger,
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
        if (pkgDescriptor.isOptimizedDeployment == null) return true;
        else return pkgDescriptor.isOptimizedDeployment;
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
