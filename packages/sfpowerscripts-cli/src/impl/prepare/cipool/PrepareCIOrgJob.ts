import InstallPackageDependenciesImpl from "@dxatscale/sfpowerscripts.core/lib/sfdxwrappers/InstallPackageDependenciesImpl";
import { PackageInstallationStatus } from "@dxatscale/sfpowerscripts.core/lib/package/PackageInstallationResult";
import DeployImpl, {
  DeploymentMode,
  DeployProps,
} from "../../deploy/DeployImpl";
import SFPLogger, {
  FileLogger,
  LoggerLevel,
} from "@dxatscale/sfpowerscripts.core/lib/logger/SFPLogger";
import { Stage } from "../../Stage";
import SFPStatsSender from "@dxatscale/sfpowerscripts.core/lib/stats/SFPStatsSender";
import InstallUnlockedPackageImpl from "@dxatscale/sfpowerscripts.core/lib/sfdxwrappers/InstallUnlockedPackageImpl";
import ScratchOrg from "@dxatscale/sfpowerscripts.core/src/scratchorg/ScratchOrg";
import PoolJobExecutor, {
  JobError,
  ScriptExecutionResult,
} from "../../pool/PoolJobExecutor";
import { Org } from "@salesforce/core";
import ProjectConfig from "@dxatscale/sfpowerscripts.core/lib/project/ProjectConfig";
import { PoolConfig } from "../../pool/PoolConfig";
import { Result, ok, err } from "neverthrow";
import { ArtifactFilePaths } from "@dxatscale/sfpowerscripts.core/lib/artifacts/ArtifactFilePathFetcher";
const path = require("path");
import * as fs from "fs-extra";

const SFPOWERSCRIPTS_ARTIFACT_PACKAGE = "04t1P000000ka9mQAA";
export default class PrepareCIOrgJob extends PoolJobExecutor {
  private checkPointPackages: string[];

  public constructor(
    protected pool: PoolConfig,
    private artifacts: ArtifactFilePaths[]
  ) {
    super(pool);
  }

  async executeJob(
    scratchOrg: ScratchOrg,
    hubOrg: Org,
    logToFilePath: string
  ): Promise<Result<ScriptExecutionResult, JobError>> {
    //Install sfpowerscripts Artifact

    try {

      let packageLogger: FileLogger = new FileLogger(logToFilePath);
      this.checkPointPackages = this.getcheckPointPackages(packageLogger);

      SFPLogger.log(
        `Installing sfpowerscripts_artifact package to the ${scratchOrg.alias}`,
        null,
        packageLogger
      );

      let installUnlockedPackageImpl: InstallUnlockedPackageImpl = new InstallUnlockedPackageImpl(
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

      if (this.artifacts) {
        let deploymentResult;
        if (true) {
          deploymentResult = await this.pushArtifacts(
            scratchOrg,
            packageLogger
          );
        } else {
          deploymentResult = await this.deployAllPackagesInTheRepo(
            scratchOrg,
            packageLogger
          );
        }
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

        // consolidate source tracking files
        let aggregatedSourceTrackingDir = ".sfpowerscripts/source-tracking-files";
        fs.mkdirpSync(aggregatedSourceTrackingDir);
        for (let artifact of this.artifacts) {
          let artifactsOrgsDir = path.join(artifact.sourceDirectoryPath, ".sfdx", "orgs"); // may not exist
          if (fs.existsSync(artifactsOrgsDir)) {
            let usernames = fs.readdirSync(artifactsOrgsDir);
            for (let username of usernames) {
              let aggregatedUsernameDir = path.join(aggregatedSourceTrackingDir, username);
              fs.mkdirpSync(aggregatedUsernameDir);

              let artifactsMaxRevisionFilePath = path.join(artifactsOrgsDir, username, "maxRevision.json");
              let artifactsSourcePathInfosFilePath = path.join(artifactsOrgsDir, username, "sourcePathInfos.json");

              if (fs.existsSync(artifactsMaxRevisionFilePath) && fs.existsSync(artifactsSourcePathInfosFilePath)) {
                let aggregatedMaxRevisionFilePath = path.join(aggregatedUsernameDir, "maxRevision.json");
                let aggregatedSourcePathinfosFilePath = path.join(aggregatedUsernameDir, "sourcePathInfos.json");
                if (fs.existsSync(aggregatedMaxRevisionFilePath) && fs.existsSync(aggregatedSourcePathinfosFilePath)) {
                  // Replace maxRevision.json
                  fs.copySync(artifactsMaxRevisionFilePath, aggregatedMaxRevisionFilePath, { overwrite: true });

                  // Concatenate sourcePathInfos.json
                  let aggregatedSourcePathInfos = fs.readJSONSync(aggregatedSourcePathinfosFilePath, {encoding: "UTF-8"});
                  let sourcePathInfos = fs.readJSONSync(artifactsOrgsDir, {encoding: "UTF-8"});
                  Object.assign(aggregatedSourcePathInfos, sourcePathInfos)

                  fs.writeJSONSync(aggregatedSourcePathinfosFilePath, aggregatedSourcePathInfos);
                } else {
                  fs.copySync(path.join(artifactsOrgsDir, username), path.join(aggregatedUsernameDir));
                }
              } else {
                continue;
              }
            }
          } else {
            continue;
          }
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

  private async pushArtifacts(
    scratchOrg: ScratchOrg,
    packageLogger: any
  ) {

    let deployProps: DeployProps = {
      deploymentMode: DeploymentMode.SOURCEPACKAGES_PUSH,
      artifacts: this.artifacts,
      targetUsername: scratchOrg.username,
      artifactDir: null,
      isTestsToBeTriggered: false,
      skipIfPackageInstalled: false,
      waitTime: 120,
      packageLogger: packageLogger,
      currentStage: Stage.PREPARE,
      isRetryOnFailure: this.pool.cipool.retryOnFailure
    }

    //Deploy the fetched artifacts to the org
    let deployImpl: DeployImpl = new DeployImpl(deployProps);

    let deploymentResult = await deployImpl.exec();

    return deploymentResult;
  }
  private async deployAllPackagesInTheRepo(
    scratchOrg: ScratchOrg,
    packageLogger: any
  ) {
    SFPLogger.log(`Deploying all packages in the repo to  ${scratchOrg.alias}`);
    SFPLogger.log(
      `Deploying all packages in the repo to  ${scratchOrg.alias}`,
      LoggerLevel.INFO,
      packageLogger
    );

    let deployProps: DeployProps = {
      targetUsername: scratchOrg.username,
      artifactDir: null,
      waitTime: 120,
      currentStage: Stage.PREPARE,
      packageLogger: packageLogger,
      isTestsToBeTriggered: false,
      skipIfPackageInstalled: false,
      deploymentMode: this.pool.cipool.installAsSourcePackages
        ? DeploymentMode.SOURCEPACKAGES
        : DeploymentMode.NORMAL,
      isRetryOnFailure: this.pool.cipool.retryOnFailure,
      artifacts: this.artifacts
    };

    //Deploy the fetched artifacts to the org
    let deployImpl: DeployImpl = new DeployImpl(deployProps);

    let deploymentResult = await deployImpl.exec();

    return deploymentResult;
  }

  private handleDeploymentErrorsForFullDeployment(
    scratchOrg: ScratchOrg,
    deploymentResult: {
      deployed: string[];
      failed: string[];
      testFailure: string;
      error: any;
    },
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
        JSON.stringify(deploymentResult.failed),
        LoggerLevel.INFO,
        packageLogger
      );
      SFPLogger.log(
        `Deployment of packages failed in ${scratchOrg.alias}, this scratch org will be deleted`,
        LoggerLevel.INFO,
        packageLogger
      );
      throw new Error(
        "Following Packages failed to deploy:" + deploymentResult.failed
      );
    }
  }

  private handleDeploymentErrorsForPartialDeployment(
    scratchOrg: ScratchOrg,
    deploymentResult: {
      deployed: string[];
      failed: string[];
      testFailure: string;
      error: any;
    },
    packageLogger: any
  ) {
    //Handle Deployment Failures
    if (deploymentResult.failed.length > 0 || deploymentResult.error) {
      if (this.checkPointPackages.length > 0) {
        let isCheckPointSucceded = this.checkPointPackages.some((pkg) =>
          deploymentResult.deployed.includes(pkg)
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
}
