import DeployImpl, { DeploymentMode, DeployProps, DeploymentResult } from '../deploy/DeployImpl';
import SFPLogger, { FileLogger, LoggerLevel, Logger, COLOR_KEY_MESSAGE } from '@dxatscale/sfp-logger';
import { Stage } from '../Stage';
import SFPStatsSender from '@dxatscale/sfpowerscripts.core/lib/stats/SFPStatsSender';
import ScratchOrg from '@dxatscale/sfpowerscripts.core/lib/scratchorg/ScratchOrg';
import { Result, ok, err } from 'neverthrow';
import PoolJobExecutor, {
    JobError,
    ScriptExecutionResult,
} from '@dxatscale/sfpowerscripts.core/lib/scratchorg/pool/PoolJobExecutor';
import { Connection, Org } from '@salesforce/core';
import ProjectConfig from '@dxatscale/sfpowerscripts.core/lib/project/ProjectConfig';
import { PoolConfig } from '@dxatscale/sfpowerscripts.core/lib/scratchorg/pool/PoolConfig';
import VlocityPackUpdateSettings from '@dxatscale/sfpowerscripts.core/lib/vlocitywrapper/VlocityPackUpdateSettings';
import VlocityInitialInstall from '@dxatscale/sfpowerscripts.core/lib/vlocitywrapper/VlocityInitialInstall';
import ScriptExecutor from '@dxatscale/sfpowerscripts.core/lib/scriptExecutor/ScriptExecutorHelpers';
import DeploymentSettingsService from '@dxatscale/sfpowerscripts.core/lib/deployers/DeploymentSettingsService';
import PackageDetails from '@dxatscale/sfpowerscripts.core/lib/package/Package2Detail';
import InstallUnlockedPackageCollection from '@dxatscale/sfpowerscripts.core/lib/package/packageInstallers/InstallUnlockedPackageCollection';
import SFPOrg from '@dxatscale/sfpowerscripts.core/lib/org/SFPOrg';
const fs = require('fs-extra');

const SFPOWERSCRIPTS_ARTIFACT_PACKAGE = '04t1P000000ka9mQAA';
export default class PrepareOrgJob extends PoolJobExecutor {
    private checkPointPackages: string[];

    public constructor(protected pool: PoolConfig, private externalPackage2s: PackageDetails[]) {
        super(pool);
    }

    async executeJob(
        scratchOrg: ScratchOrg,
        hubOrg: Org,
        logToFilePath: string,
        logLevel: LoggerLevel
    ): Promise<Result<ScriptExecutionResult, JobError>> {
        //Install sfpowerscripts Artifact

        try {
            const conn = (await Org.create({ aliasOrUsername: scratchOrg.username })).getConnection();
            let sfpOrg = await SFPOrg.create({ connection: conn });
            let invidualScratchOrgLogFile: FileLogger = new FileLogger(logToFilePath);
            let packageCollectionInstaller = new InstallUnlockedPackageCollection(sfpOrg, invidualScratchOrgLogFile);

            this.checkPointPackages = this.getcheckPointPackages(invidualScratchOrgLogFile);

            if (this.pool.relaxAllIPRanges || this.pool.ipRangesToBeRelaxed) {
                await this.relaxIPRanges(
                    conn,
                    this.pool.relaxAllIPRanges,
                    this.pool.ipRangesToBeRelaxed,
                    invidualScratchOrgLogFile
                );
            }

            SFPLogger.log(
                `Installing sfpowerscripts_artifact package to the ${scratchOrg.alias}`,
                null,
                invidualScratchOrgLogFile
            );

            //Install sfpowerscripts artifact package
            await packageCollectionInstaller.install(
                [
                    {
                        name: 'sfpowerscripts_artifact2',
                        subscriberPackageVersionId: process.env.SFPOWERSCRIPTS_ARTIFACT_PACKAGE
                            ? process.env.SFPOWERSCRIPTS_ARTIFACT_PACKAGE
                            : SFPOWERSCRIPTS_ARTIFACT_PACKAGE,
                    },
                ],
                true
            );

            await this.preInstallScript(scratchOrg, hubOrg, invidualScratchOrgLogFile);

            SFPLogger.log(
                `Installing package depedencies to the ${scratchOrg.alias}`,
                LoggerLevel.INFO,
                invidualScratchOrgLogFile
            );

            SFPLogger.log(`Installing Package Dependencies of this repo in ${scratchOrg.alias}`);

            await packageCollectionInstaller.install(this.externalPackage2s, true);

            SFPLogger.log(`Successfully completed Installing Package Dependencies of this repo in ${scratchOrg.alias}`);

            //Hook Velocity Deployment
            if (this.pool.enableVlocity)
                await this.prepareVlocityDataPacks(scratchOrg, invidualScratchOrgLogFile, logLevel);
            let deploymentSucceed;
            if (this.pool.installAll) {
                let deploymentResult: DeploymentResult;

                let deploymentMode: DeploymentMode;
                if (this.pool.enableSourceTracking || this.pool.enableSourceTracking === undefined) {
                    deploymentMode = DeploymentMode.SOURCEPACKAGES_PUSH;
                } else {
                    deploymentMode = DeploymentMode.SOURCEPACKAGES;
                }

                deploymentResult = await this.deployAllPackagesInTheRepo(
                    scratchOrg,
                    invidualScratchOrgLogFile,
                    deploymentMode
                );

                SFPStatsSender.logGauge('prepare.packages.scheduled', deploymentResult.scheduled, {
                    poolName: this.pool.tag,
                });

                SFPStatsSender.logGauge('prepare.packages.succeeded', deploymentResult.deployed.length, {
                    poolName: this.pool.tag,
                });

                SFPStatsSender.logGauge('prepare.packages.failed', deploymentResult.failed.length, {
                    poolName: this.pool.tag,
                });

                if (deploymentResult.failed.length > 0 || deploymentResult.error) {
                    this.pool.succeedOnDeploymentErrors
                        ? this.handleDeploymentErrorsForPartialDeployment(
                              scratchOrg,
                              deploymentResult,
                              invidualScratchOrgLogFile
                          )
                        : this.handleDeploymentErrorsForFullDeployment(
                              scratchOrg,
                              deploymentResult,
                              invidualScratchOrgLogFile
                          );
                    deploymentSucceed = 'failed';
                }
                deploymentSucceed = 'succeed';
            }

            await this.postInstallScript(scratchOrg, hubOrg, invidualScratchOrgLogFile, deploymentSucceed);

            return ok({ scratchOrgUsername: scratchOrg.username });
        } catch (error) {
            return err({
                message: error.message,
                scratchOrgUsername: scratchOrg.username,
            });
        }
    }

    private async deployAllPackagesInTheRepo(
        scratchOrg: ScratchOrg,
        packageLogger: any,
        deploymentMode: DeploymentMode
    ) {
        SFPLogger.log(`Deploying all packages in the repo to  ${scratchOrg.alias}`);
        SFPLogger.log(`Deploying all packages in the repo to  ${scratchOrg.alias}`, LoggerLevel.INFO, packageLogger);

        let deployProps: DeployProps = {
            targetUsername: scratchOrg.username,
            artifactDir: 'artifacts',
            waitTime: 120,
            currentStage: Stage.PREPARE,
            packageLogger: packageLogger,
            isTestsToBeTriggered: false,
            skipIfPackageInstalled: true,
            deploymentMode: deploymentMode,
            isRetryOnFailure: this.pool.retryOnFailure,
        };

        //Deploy the fetched artifacts to the org
        let deployImpl: DeployImpl = new DeployImpl(deployProps);

        let deploymentResult = await deployImpl.exec();

        return deploymentResult;
    }

    private handleDeploymentErrorsForFullDeployment(
        scratchOrg: ScratchOrg,
        deploymentResult: DeploymentResult,
        packageLogger: any
    ) {
        //Write to Scratch Org Logs
        SFPLogger.log(`Following Packages failed to deploy in ${scratchOrg.alias}`, LoggerLevel.INFO, packageLogger);
        SFPLogger.log(
            JSON.stringify(deploymentResult.failed.map((packageInfo) => packageInfo.sfpPackage.packageName)),
            LoggerLevel.INFO,
            packageLogger
        );
        SFPLogger.log(
            `Deployment of packages failed in ${scratchOrg.alias}, this scratch org will be deleted`,
            LoggerLevel.INFO,
            packageLogger
        );
        throw new Error(
            'Following Packages failed to deploy:' +
                deploymentResult.failed.map((packageInfo) => packageInfo.sfpPackage.packageName)
        );
    }

    private handleDeploymentErrorsForPartialDeployment(
        scratchOrg: ScratchOrg,
        deploymentResult: DeploymentResult,
        packageLogger: any
    ) {
        if (this.checkPointPackages.length > 0) {
            let isCheckPointSucceded = this.checkPointPackages.some((pkg) =>
                deploymentResult.deployed.map((packageInfo) => packageInfo.sfpPackage.packageName).includes(pkg)
            );
            if (!isCheckPointSucceded) {
                SFPStatsSender.logCount('prepare.org.checkpointfailed');
                SFPLogger.log(
                    `One or some of the check point packages ${this.checkPointPackages} failed to deploy, Deleting ${scratchOrg.alias}`,
                    LoggerLevel.INFO,
                    packageLogger
                );
                throw new Error(`One or some of the check point Packages ${this.checkPointPackages} failed to deploy`);
            }
        } else {
            SFPStatsSender.logCount('prepare.org.partial');
            SFPLogger.log(
                `Cancelling any further packages to be deployed, Adding the scratchorg ${scratchOrg.alias} to the pool`,
                LoggerLevel.INFO,
                packageLogger
            );
        }
    }

    //Fetch all checkpoints
    private getcheckPointPackages(logger: FileLogger) {
        SFPLogger.log('Fetching checkpoints for prepare if any.....', LoggerLevel.INFO, logger);

        let checkPointPackages = [];
        ProjectConfig.getAllPackageDirectoriesFromDirectory(null).forEach((pkg) => {
            if (pkg.checkpointForPrepare) checkPointPackages.push(pkg['package']);
        });
        return checkPointPackages;
    }

    private async relaxIPRanges(
        conn: Connection,
        isRelaxAllIPRanges: boolean,
        relaxIPRanges: string[],
        logger: Logger
    ): Promise<void> {
        SFPLogger.log(`Relaxing ip ranges for scratchOrg with user ${conn.getUsername()}`, LoggerLevel.INFO);
        if (isRelaxAllIPRanges) {
            relaxIPRanges = [];
            return new DeploymentSettingsService(conn).relaxAllIPRanges(logger);
        } else {
            return new DeploymentSettingsService(conn).relaxAllIPRanges(logger, relaxIPRanges);
        }
    }

    //Prepare for vlocity
    private async prepareVlocityDataPacks(scratchOrg: ScratchOrg, logger: Logger, logLevel: LoggerLevel) {
        SFPLogger.log(COLOR_KEY_MESSAGE('Installing Vlocity Configurations..'), LoggerLevel.INFO, logger);
        let vlocityPackSettingsUpdate: VlocityPackUpdateSettings = new VlocityPackUpdateSettings(
            null,
            scratchOrg.username,
            logger,
            logLevel
        );
        await vlocityPackSettingsUpdate.exec(false);

        let vlocityInitialInstall: VlocityInitialInstall = new VlocityInitialInstall(
            null,
            scratchOrg.username,
            logger,
            logLevel
        );
        await vlocityInitialInstall.exec(false);
        SFPLogger.log(
            COLOR_KEY_MESSAGE('Succesfully completed all vlocity config installation'),
            LoggerLevel.INFO,
            logger
        );
    }

    public async preInstallScript(scratchOrg: ScratchOrg, hubOrg: Org, packageLogger: any) {
        if (fs.existsSync(this.pool.preDependencyInstallationScriptPath)) {
            SFPLogger.log(
                `Executing pre script for ` +
                    scratchOrg.alias +
                    ', script path:' +
                    this.pool.preDependencyInstallationScriptPath,
                LoggerLevel.INFO
            );
            await ScriptExecutor.executeScript(
                packageLogger,
                this.pool.preDependencyInstallationScriptPath,
                scratchOrg.username,
                hubOrg.getUsername()
            );
        }
    }

    public async postInstallScript(scratchOrg: ScratchOrg, hubOrg: Org, packageLogger: any, deploymentStatus: string) {
        if (fs.existsSync(this.pool.postDeploymentScriptPath)) {
            SFPLogger.log(
                `Executing pre script for ` + scratchOrg.alias + ', script path:' + this.pool.postDeploymentScriptPath,
                LoggerLevel.INFO
            );
            await ScriptExecutor.executeScript(
                packageLogger,
                this.pool.postDeploymentScriptPath,
                scratchOrg.username,
                hubOrg.getUsername(),
                deploymentStatus
            );
        }
    }
}
