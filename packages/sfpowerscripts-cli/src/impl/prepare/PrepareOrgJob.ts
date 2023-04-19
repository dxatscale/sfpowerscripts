import DeployImpl, { DeploymentMode, DeployProps, DeploymentResult } from '../deploy/DeployImpl';
import SFPLogger, { LoggerLevel, Logger, COLOR_KEY_MESSAGE, ConsoleLogger } from '@dxatscale/sfp-logger';
import { Stage } from '../Stage';
import SFPStatsSender from '@dxatscale/sfpowerscripts.core/lib/stats/SFPStatsSender';
import ScratchOrg from '@dxatscale/sfpowerscripts.core/lib/scratchorg/ScratchOrg';
import { Result, ok, err } from 'neverthrow';
import PoolJobExecutor, {
    JobError,
    ScriptExecutionResult,
} from '@dxatscale/sfpowerscripts.core/lib/scratchorg/pool/PoolJobExecutor';
import { Connection, Org } from '@salesforce/core';
import { PoolConfig } from '@dxatscale/sfpowerscripts.core/lib/scratchorg/pool/PoolConfig';
import VlocityPackUpdateSettings from '@dxatscale/sfpowerscripts.core/lib/vlocitywrapper/VlocityPackUpdateSettings';
import VlocityInitialInstall from '@dxatscale/sfpowerscripts.core/lib/vlocitywrapper/VlocityInitialInstall';
import ScriptExecutor from '@dxatscale/sfpowerscripts.core/lib/scriptExecutor/ScriptExecutorHelpers';
import DeploymentSettingsService from '@dxatscale/sfpowerscripts.core/lib/deployers/DeploymentSettingsService';
import PackageDetails from '@dxatscale/sfpowerscripts.core/lib/package/Package2Detail';
import InstallUnlockedPackageCollection from '@dxatscale/sfpowerscripts.core/lib/package/packageInstallers/InstallUnlockedPackageCollection';
import SFPOrg from '@dxatscale/sfpowerscripts.core/lib/org/SFPOrg';
import { PreDeployHook } from '../deploy/PreDeployHook';
import SfpPackage from '@dxatscale/sfpowerscripts.core/lib/package/SfpPackage';
import ExternalPackage2DependencyResolver from '@dxatscale/sfpowerscripts.core/lib/package/dependencies/ExternalPackage2DependencyResolver';
import ExternalDependencyDisplayer from '@dxatscale/sfpowerscripts.core/lib/display/ExternalDependencyDisplayer';
import ProjectConfig from '@dxatscale/sfpowerscripts.core/lib/project/ProjectConfig';
import { FileLogger } from '@dxatscale/sfp-logger';
const fs = require('fs-extra');

const SFPOWERSCRIPTS_ARTIFACT_PACKAGE = '04t1P000000ka9mQAA';
export default class PrepareOrgJob extends PoolJobExecutor implements PreDeployHook {
    public constructor(
        protected pool: PoolConfig,
        private checkPointPackages: PackageDetails[],
        private externalPackage2s?: PackageDetails[]
    ) {
        super(pool);
    }

    async executeJob(
        scratchOrg: ScratchOrg,
        hubOrg: SFPOrg,
        logToFilePath: string,
        logLevel: LoggerLevel
    ): Promise<Result<ScriptExecutionResult, JobError>> {
        try {
            let scratchOrgAsSfPOrg = await SFPOrg.create({ aliasOrUsername: scratchOrg.username });
            let individualSODeploymentActivityLogger = new FileLogger(logToFilePath);
            let packageCollectionInstaller = new InstallUnlockedPackageCollection(
                scratchOrgAsSfPOrg,
                individualSODeploymentActivityLogger
            );

            //Relax IP ranges on Scractch Org
            await this.relaxIPRanges(
                scratchOrgAsSfPOrg.getConnection(),
                this.pool.relaxAllIPRanges,
                this.pool.ipRangesToBeRelaxed,
                individualSODeploymentActivityLogger
            );

            //Install sfpowerscripts package
            await this.installSfPowerscriptsArtifactPackage(
                scratchOrg,
                individualSODeploymentActivityLogger,
                packageCollectionInstaller
            );

            //Execute pre installs script
            await this.preInstallScript(scratchOrg, hubOrg, individualSODeploymentActivityLogger);

            //Install all external dependencies for non release config type
            if (!this.pool.releaseConfigFile)
                await this.installAllExternalPackageDependencies(
                    individualSODeploymentActivityLogger,
                    scratchOrgAsSfPOrg,
                    this.externalPackage2s
                );

            //Hook Velocity Deployment
            await this.prepareVlocityDataPacks(scratchOrg, individualSODeploymentActivityLogger, logLevel);

            //Deploy All Packages
            let deploymentStatus = await this.deployAllPackages(
                scratchOrg,
                hubOrg,
                individualSODeploymentActivityLogger
            );

            //Execute Post Install Script
            await this.postInstallScript(scratchOrg, hubOrg, individualSODeploymentActivityLogger, deploymentStatus);

            return ok({ scratchOrgUsername: scratchOrg.username });
        } catch (error) {
            return err({
                message: error.message,
                scratchOrgUsername: scratchOrg.username,
            });
        }
    }

    private async deployAllPackages(scratchOrg: ScratchOrg, hubOrg: Org, logger: FileLogger) {
        let deploymentSucceed: string;
        if (this.pool.installAll) {
            let deploymentResult: DeploymentResult;

            let deploymentMode: DeploymentMode;
            if (this.pool.enableSourceTracking || this.pool.enableSourceTracking === undefined) {
                deploymentMode = DeploymentMode.SOURCEPACKAGES_PUSH;
            } else {
                deploymentMode = DeploymentMode.SOURCEPACKAGES;
            }


            if(this.pool.disableSourcePackageOverride)
            {
                deploymentMode = DeploymentMode.NORMAL
            }

            deploymentResult = await this.invokeDeployImpl(scratchOrg, hubOrg, logger, deploymentMode);

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
                    ? this.handleDeploymentErrorsForPartialDeployment(scratchOrg, deploymentResult, logger)
                    : this.handleDeploymentErrorsForFullDeployment(scratchOrg, deploymentResult, logger);
                deploymentSucceed = 'failed';
            }
            deploymentSucceed = 'succeed';
        }
        return deploymentSucceed;
    }

    private async installSfPowerscriptsArtifactPackage(
        scratchOrg: ScratchOrg,
        logger: Logger,
        packageCollectionInstaller: InstallUnlockedPackageCollection
    ) {
        SFPLogger.log(`Installing sfpowerscripts_artifact package to the ${scratchOrg.alias}`, null, logger);

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

        SFPLogger.log(`Suscessfully Installed sfpowerscripts_artifact package to the ${scratchOrg.alias}`, null, logger);
    }

    private async invokeDeployImpl(
        scratchOrg: ScratchOrg,
        hubOrg: Org,
        logger: FileLogger,
        deploymentMode: DeploymentMode
    ) {
        SFPLogger.log(`Deploying packages to ${scratchOrg.alias}`);
        SFPLogger.log(`Deploying packages to ${scratchOrg.alias}`, LoggerLevel.INFO, logger);

        let deployProps: DeployProps = {
            targetUsername: scratchOrg.username,
            artifactDir: 'artifacts',
            waitTime: 120,
            currentStage: Stage.PREPARE,
            logger: logger,
            isTestsToBeTriggered: false,
            skipIfPackageInstalled: true,
            deploymentMode: deploymentMode,
            isRetryOnFailure: this.pool.retryOnFailure,
            devhubUserName: hubOrg.getUsername(),
        };

        //Deploy the fetched artifacts to the org
        let deployImpl: DeployImpl = new DeployImpl(deployProps);
        deployImpl.preDeployHook = this;
        let deploymentResult = await deployImpl.exec();

        return deploymentResult;
    }

    //Install external dependencies before installing package
    async preDeployPackage(
        sfpPackage: SfpPackage,
        targetUsername: string,
        deployedPackages?:SfpPackage[],
        devhubUserName?: string,
        logger?: Logger
    ): Promise<{ isToFailDeployment: boolean; message?: string }> {
        //Install dependencies per package if release config is provided
        if (this.pool.releaseConfigFile) {
            let sfpOrg = await SFPOrg.create({ aliasOrUsername: targetUsername });
            let hubOrg = await SFPOrg.create({ aliasOrUsername: devhubUserName });
            await this.installExternalPackageDependenciesPerPackage(logger, sfpOrg, hubOrg, this.pool.keys, sfpPackage);
        }
        return { isToFailDeployment: false };
    }

    private async installAllExternalPackageDependencies(
        logger: Logger,
        scratchOrgAsSFPOrg: SFPOrg,
        externalPackage2s: PackageDetails[]
    ) {
        SFPLogger.log(
            `Installing all external package dependencies  in ${scratchOrgAsSFPOrg.getUsername()}`,
            LoggerLevel.INFO,
            logger
        );
        let packageCollectionInstaller = new InstallUnlockedPackageCollection(scratchOrgAsSFPOrg, logger);
        await packageCollectionInstaller.install(externalPackage2s, true, true);

        SFPLogger.log(
            `Successfully completed installing all external dependencies  in ${scratchOrgAsSFPOrg.getUsername()}`,
            LoggerLevel.INFO,
            logger
        );
    }

    private async installExternalPackageDependenciesPerPackage(
        logger: Logger,
        scratchOrgAsSFPOrg: SFPOrg,
        hubOrg: SFPOrg,
        keys: string,
        sfpPackage: SfpPackage
    ) {
        //Resolve external package dependencies
        let externalPackageResolver = new ExternalPackage2DependencyResolver(
            hubOrg.getConnection(),
            ProjectConfig.getSFDXProjectConfig(null),
            keys
        );
        let externalPackage2s = await externalPackageResolver.resolveExternalPackage2DependenciesToVersions(
            [sfpPackage?.packageName]
        );

        if (sfpPackage) {
            SFPLogger.log(
                `Installing package dependencies of this ${
                    sfpPackage.packageName
                }  in ${scratchOrgAsSFPOrg.getUsername()}`,
                LoggerLevel.INFO,
                logger
            );
            //Display resolved dependenencies
            let externalDependencyDisplayer = new ExternalDependencyDisplayer(externalPackage2s, logger);
            externalDependencyDisplayer.display();
        }

        let packageCollectionInstaller = new InstallUnlockedPackageCollection(scratchOrgAsSFPOrg, logger);
        await packageCollectionInstaller.install(externalPackage2s, true, true);

        if (sfpPackage) {
            SFPLogger.log(
                `Successfully completed external dependencies of this ${
                    sfpPackage.packageName
                } in ${scratchOrgAsSFPOrg.getUsername()}`,
                LoggerLevel.INFO,
                logger
            );
        } else {
            SFPLogger.log(
                `Successfully completed installing all external dependencies  in ${scratchOrgAsSFPOrg.getUsername()}`,
                LoggerLevel.INFO,
                logger
            );
        }
    }

    private handleDeploymentErrorsForFullDeployment(
        scratchOrg: ScratchOrg,
        deploymentResult: DeploymentResult,
        logger: Logger
    ) {
        //Write to Scratch Org Logs
        SFPLogger.log(`Following Packages failed to deploy in ${scratchOrg.alias}`, LoggerLevel.INFO, logger);
        SFPLogger.log(
            JSON.stringify(deploymentResult.failed.map((packageInfo) => packageInfo.sfpPackage.packageName)),
            LoggerLevel.INFO,
            logger
        );
        SFPLogger.log(
            `Deployment of packages failed in ${scratchOrg.alias}, this scratch org will be deleted`,
            LoggerLevel.INFO,
            logger
        );
        throw new Error(
            'Following Packages failed to deploy:' +
                deploymentResult.failed.map((packageInfo) => packageInfo.sfpPackage.packageName)
        );
    }

    private handleDeploymentErrorsForPartialDeployment(
        scratchOrg: ScratchOrg,
        deploymentResult: DeploymentResult,
        logger: Logger
    ) {
        if (this.checkPointPackages.length > 0) {
            let isCheckPointSucceded = this.checkPointPackages.some((pkg) =>
                deploymentResult.deployed.map((packageInfo) => packageInfo.sfpPackage.packageName).includes(pkg.name)
            );
            if (!isCheckPointSucceded) {
                SFPStatsSender.logCount('prepare.org.checkpointfailed');
                SFPLogger.log(
                    `One or some of the check point packages  failed to deploy, Deleting ${scratchOrg.alias}`,
                    LoggerLevel.INFO,
                    logger
                );
                throw new Error(`One or some of the check point Packagesfailed to deploy`);
            }
        } else {
            SFPStatsSender.logCount('prepare.org.partial');
            SFPLogger.log(
                `Cancelling any further packages to be deployed, Adding the scratchorg ${scratchOrg.alias} to the pool`,
                LoggerLevel.INFO,
                logger
            );
        }
    }

    private async relaxIPRanges(
        conn: Connection,
        isRelaxAllIPRanges: boolean,
        relaxIPRanges: string[],
        logger: Logger
    ): Promise<void> {
        if (isRelaxAllIPRanges || relaxIPRanges) {
            if (isRelaxAllIPRanges) {
                SFPLogger.log(
                    `Relaxing all IP ranges for scratchOrg with user ${conn.getUsername()}`,
                    LoggerLevel.INFO
                );
                relaxIPRanges = [];
                return new DeploymentSettingsService(conn).relaxAllIPRanges(logger);
            } else {
                SFPLogger.log(`Relaxing IP ranges for scratchOrg with user ${conn.getUsername()}`, LoggerLevel.INFO);
                return new DeploymentSettingsService(conn).relaxAllIPRanges(logger, relaxIPRanges);
            }
        }
    }

    //Prepare for vlocity
    private async prepareVlocityDataPacks(scratchOrg: ScratchOrg, logger: Logger, logLevel: LoggerLevel) {
        if (this.pool.enableVlocity) {
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
    }

    //execute global pre install script
    public async preInstallScript(scratchOrg: ScratchOrg, hubOrg: Org, logger: Logger) {
        if (fs.existsSync(this.pool.preDependencyInstallationScriptPath)) {
            SFPLogger.log(
                `Executing pre script for ` +
                    scratchOrg.alias +
                    ', script path:' +
                    this.pool.preDependencyInstallationScriptPath,
                LoggerLevel.INFO
            );
            await ScriptExecutor.executeScript(
                logger,
                this.pool.preDependencyInstallationScriptPath,
                scratchOrg.username,
                hubOrg.getUsername()
            );
        }
    }

    public async postInstallScript(scratchOrg: ScratchOrg, hubOrg: Org, logger: Logger, deploymentStatus: string) {
        if (fs.existsSync(this.pool.postDeploymentScriptPath)) {
            SFPLogger.log(
                `Executing post script for ` + scratchOrg.alias + ', script path:' + this.pool.postDeploymentScriptPath,
                LoggerLevel.INFO
            );
            await ScriptExecutor.executeScript(
                logger,
                this.pool.postDeploymentScriptPath,
                scratchOrg.username,
                hubOrg.getUsername(),
                deploymentStatus
            );
        }
    }
}
