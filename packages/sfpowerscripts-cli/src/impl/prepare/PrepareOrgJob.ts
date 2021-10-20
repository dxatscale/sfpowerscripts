import InstallPackageDependenciesImpl from "@dxatscale/sfpowerscripts.core/lib/sfdxwrappers/InstallPackageDependenciesImpl";
import { PackageInstallationStatus } from "@dxatscale/sfpowerscripts.core/lib/package/packageInstallers/PackageInstallationResult";
import DeployImpl, {
  DeploymentMode,
  DeployProps,
  DeploymentResult
} from "../deploy/DeployImpl";
import SFPLogger, {
  FileLogger,
  LoggerLevel,
  Logger,
  COLOR_KEY_MESSAGE
} from "@dxatscale/sfpowerscripts.core/lib/logger/SFPLogger";
import { Stage } from "../Stage";
import SFPStatsSender from "@dxatscale/sfpowerscripts.core/lib/stats/SFPStatsSender";
import InstallUnlockedPackageImpl from "@dxatscale/sfpowerscripts.core/lib/sfdxwrappers/InstallUnlockedPackageImpl";
import ScratchOrg from "@dxatscale/sfpowerscripts.core/lib/scratchorg/ScratchOrg";
import PoolJobExecutor, {
  JobError,
  ScriptExecutionResult,
} from "../pool/PoolJobExecutor";
import { Connection, Org } from "@salesforce/core";
import ProjectConfig from "@dxatscale/sfpowerscripts.core/lib/project/ProjectConfig";
import { PoolConfig } from "../pool/PoolConfig";
import { Result, ok, err } from "neverthrow";
import RelaxIPRange from "@dxatscale/sfpowerscripts.core/lib/iprange/RelaxIPRange"
import SourceTrackingResourceController from "../pool/SourceTrackingResourceController";
import VlocityPackUpdateSettings from "@dxatscale/sfpowerscripts.core/lib/vlocitywrapper/VlocityPackUpdateSettings";
import VlocityInitialInstall from "@dxatscale/sfpowerscripts.core/lib/vlocitywrapper/VlocityInitialInstall";


const SFPOWERSCRIPTS_ARTIFACT_PACKAGE = "04t1P000000ka9mQAA";
export default class PrepareOrgJob extends PoolJobExecutor {
  private checkPointPackages: string[];

  public constructor(
    protected pool: PoolConfig,
  ) {
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
      const conn = (await Org.create({aliasOrUsername: scratchOrg.username})).getConnection();

      let packageLogger: FileLogger = new FileLogger(logToFilePath);
      this.checkPointPackages = this.getcheckPointPackages(packageLogger);

      if (this.pool.relaxAllIPRanges || this.pool.ipRangesToBeRelaxed) {
        await this.relaxIPRanges(
          conn,
          this.pool.relaxAllIPRanges,
          this.pool.ipRangesToBeRelaxed,
          packageLogger
        );
      }


      SFPLogger.log(
        `Installing sfpowerscripts_artifact package to the ${scratchOrg.alias}`,
        null,
        packageLogger
      );

      let installUnlockedPackageImpl: InstallUnlockedPackageImpl = new InstallUnlockedPackageImpl(
        packageLogger,
        logLevel,
        null,
        scratchOrg.username,
        process.env.SFPOWERSCRIPTS_ARTIFACT_PACKAGE
          ? process.env.SFPOWERSCRIPTS_ARTIFACT_PACKAGE
          : SFPOWERSCRIPTS_ARTIFACT_PACKAGE,
        "60"
      );

      await installUnlockedPackageImpl.exec(true);

      SFPLogger.log(
        `Installing package depedencies to the ${scratchOrg.alias}`,
        LoggerLevel.INFO,
        packageLogger
      );
      SFPLogger.log(
        `Installing Package Dependencies of this repo in ${scratchOrg.alias}`
      );

      // Install Dependencies
      let installDependencies: InstallPackageDependenciesImpl = new InstallPackageDependenciesImpl(
        scratchOrg.username,
        hubOrg.getUsername(),
        120,
        null,
        this.pool.keys,
        true,
        packageLogger
      );
      let installationResult = await installDependencies.exec();
      if (installationResult.result == PackageInstallationStatus.Failed) {
        throw new Error(installationResult.message);
      }

      SFPLogger.log(
        `Successfully completed Installing Package Dependencies of this repo in ${scratchOrg.alias}`
      );



      //Hook Velocity Deployment
      if(this.pool.enableVlocity)
        await this.prepareVlocityDataPacks(scratchOrg,packageLogger,logLevel);

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
          packageLogger,
          deploymentMode
        );

        SFPStatsSender.logGauge(
          "prepare.packages.scheduled",
          deploymentResult.scheduled,
          {
            poolName: this.pool.tag
          }
        );

        SFPStatsSender.logGauge(
          "prepare.packages.succeeded",
          deploymentResult.deployed.length,
          {
            poolName: this.pool.tag
          }
        );

        SFPStatsSender.logGauge(
          "prepare.packages.failed",
          deploymentResult.failed.length,
          {
            poolName: this.pool.tag
          }
        );


        this.pool.succeedOnDeploymentErrors
          ? this.handleDeploymentErrorsForPartialDeployment(
              scratchOrg,
              deploymentResult,
              packageLogger
            )
          : this.handleDeploymentErrorsForFullDeployment(
              scratchOrg,
              deploymentResult,
              packageLogger
            );

        if (deploymentMode === DeploymentMode.SOURCEPACKAGES_PUSH) {
          let sourceTrackingResourceController = new SourceTrackingResourceController(conn, packageLogger);
          sourceTrackingResourceController.createSourceTrackingResources(deploymentResult);
          await sourceTrackingResourceController.deploy();
        }


      }



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
    SFPLogger.log(
      `Deploying all packages in the repo to  ${scratchOrg.alias}`,
      LoggerLevel.INFO,
      packageLogger
    );

    let deployProps: DeployProps = {
      targetUsername: scratchOrg.username,
      artifactDir: "artifacts",
      waitTime: 120,
      currentStage: Stage.PREPARE,
      packageLogger: packageLogger,
      isTestsToBeTriggered: false,
      skipIfPackageInstalled: false,
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
    //Handle Deployment Failures
    if (deploymentResult.failed.length > 0 || deploymentResult.error) {
      //Write to Scratch Org Logs
      SFPLogger.log(
        `Following Packages failed to deploy in ${scratchOrg.alias}`,
        LoggerLevel.INFO,
        packageLogger
      );
      SFPLogger.log(
        JSON.stringify(deploymentResult.failed.map((packageInfo) => packageInfo.packageMetadata.package_name)),
        LoggerLevel.INFO,
        packageLogger
      );
      SFPLogger.log(
        `Deployment of packages failed in ${scratchOrg.alias}, this scratch org will be deleted`,
        LoggerLevel.INFO,
        packageLogger
      );
      throw new Error(
        "Following Packages failed to deploy:" + deploymentResult.failed.map((packageInfo) => packageInfo.packageMetadata.package_name)
      );
    }
  }

  private handleDeploymentErrorsForPartialDeployment(
    scratchOrg: ScratchOrg,
    deploymentResult: DeploymentResult,
    packageLogger: any
  ) {
    //Handle Deployment Failures
    if (deploymentResult.failed.length > 0 || deploymentResult.error) {
      if (this.checkPointPackages.length > 0) {
        let isCheckPointSucceded = this.checkPointPackages.some((pkg) =>
          deploymentResult.deployed.map((packageInfo) => packageInfo.packageMetadata.package_name).includes(pkg)
        );
        if (!isCheckPointSucceded) {
          SFPStatsSender.logCount("prepare.org.checkpointfailed");
          SFPLogger.log(
            `One or some of the check point packages ${this.checkPointPackages} failed to deploy, Deleting ${scratchOrg.alias}`,
            LoggerLevel.INFO,
            packageLogger
          );
          throw new Error(
            `One or some of the check point Packages ${this.checkPointPackages} failed to deploy`
          );
        }
      } else {
        SFPStatsSender.logCount("prepare.org.partial");
        SFPLogger.log(
          `Cancelling any further packages to be deployed, Adding the scratchorg ${scratchOrg.alias} to the pool`,
          LoggerLevel.INFO,
          packageLogger
        );
      }
    }
  }

  //Fetch all checkpoints
  private getcheckPointPackages(logger:FileLogger) {
    SFPLogger.log("Fetching checkpoints for prepare if any.....",LoggerLevel.INFO,logger);
    let projectConfig = ProjectConfig.getSFDXPackageManifest(null);
    let checkPointPackages = [];
    projectConfig["packageDirectories"].forEach((pkg) => {
      if (pkg.checkpointForPrepare) checkPointPackages.push(pkg["package"]);
    });
    return checkPointPackages;
  }

  private async relaxIPRanges(
    conn: Connection,
    isRelaxAllIPRanges: boolean,
    relaxIPRanges: string[],
    logger: Logger
  ): Promise<{ username: string; success: boolean }> {
    SFPLogger.log(
      `Relaxing ip ranges for scratchOrg with user ${conn.getUsername()}`,
      LoggerLevel.INFO
    );
    if (isRelaxAllIPRanges) {
      relaxIPRanges = [];
      return new RelaxIPRange(logger).setIp(
        conn,
        relaxIPRanges,
        true
      );
    } else {
      return new RelaxIPRange(logger).setIp(
        conn,
        relaxIPRanges
      );
    }
  }


  //Prepare for vlocity
  private async prepareVlocityDataPacks(scratchOrg:ScratchOrg,logger:Logger,logLevel:LoggerLevel)
  {

    SFPLogger.log(COLOR_KEY_MESSAGE("Installing Vlocity Configurations.."),LoggerLevel.INFO,logger);
    let vlocityPackSettingsUpdate:VlocityPackUpdateSettings = new VlocityPackUpdateSettings(null,scratchOrg.username,logger,logLevel);
    await vlocityPackSettingsUpdate.exec(false);

    let vlocityInitialInstall:VlocityInitialInstall = new VlocityInitialInstall(null,scratchOrg.username,logger,logLevel);
    await vlocityInitialInstall.exec(false);
    SFPLogger.log(COLOR_KEY_MESSAGE("Succesfully completed all vlocity config installation"),LoggerLevel.INFO,logger);
  }



}
