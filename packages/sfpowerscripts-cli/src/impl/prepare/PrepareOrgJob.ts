import InstallPackageDependenciesImpl from "@dxatscale/sfpowerscripts.core/lib/sfdxwrappers/InstallPackageDependenciesImpl";
import { PackageInstallationStatus } from "@dxatscale/sfpowerscripts.core/lib/package/PackageInstallationResult";
import DeployImpl, {
  DeploymentMode,
  DeployProps,
  DeploymentResult
} from "../deploy/DeployImpl";
import SFPLogger, {
  FileLogger,
  LoggerLevel,
  Logger
} from "@dxatscale/sfpowerscripts.core/lib/logger/SFPLogger";
import { Stage } from "../Stage";
import SFPStatsSender from "@dxatscale/sfpowerscripts.core/lib/stats/SFPStatsSender";
import InstallUnlockedPackageImpl from "@dxatscale/sfpowerscripts.core/lib/sfdxwrappers/InstallUnlockedPackageImpl";
import ScratchOrg from "@dxatscale/sfpowerscripts.core/src/scratchorg/ScratchOrg";
import PoolJobExecutor, {
  JobError,
  ScriptExecutionResult,
} from "../pool/PoolJobExecutor";
import { AuthInfo, Connection, Org } from "@salesforce/core";
import ProjectConfig from "@dxatscale/sfpowerscripts.core/lib/project/ProjectConfig";
import { PoolConfig } from "../pool/PoolConfig";
import { Result, ok, err } from "neverthrow";
import { ArtifactFilePaths } from "@dxatscale/sfpowerscripts.core/lib/artifacts/ArtifactFilePathFetcher";
const path = require("path");
import * as fs from "fs-extra";
import lodash = require("lodash");
import AdmZip = require("adm-zip");
import child_process = require("child_process");
import RelaxIPRange from "@dxatscale/sfpowerscripts.core/lib/iprange/RelaxIPRange"

const SFPOWERSCRIPTS_ARTIFACT_PACKAGE = "04t1P000000ka9mQAA";
export default class PrepareOrgJob extends PoolJobExecutor {
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

      await this.relaxIPRanges(
        scratchOrg,
        this.pool.relaxAllIPRanges,
        this.pool.ipRangesToBeRelaxed,
        packageLogger
      );

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
        let deploymentResult: DeploymentResult;
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
        // TODO: only run for push
        let aggregatedSourceTrackingDir = ".sfpowerscripts/sourceTrackingFiles";
        let aggregatedUsernameDir = path.join(aggregatedSourceTrackingDir, scratchOrg.username);
        let aggregatedMaxRevisionFilePath = path.join(aggregatedUsernameDir, "maxRevision.json");
        let aggregatedSourcePathinfosFilePath = path.join(aggregatedUsernameDir, "sourcePathInfos.json");

        fs.mkdirpSync(aggregatedUsernameDir);

        for (let packageInfoOfDeployedArtifact of deploymentResult.deployed) {
          console.log(packageInfoOfDeployedArtifact.sourceDirectory);
          let orgsDir = path.join(packageInfoOfDeployedArtifact.sourceDirectory, ".sfdx", "orgs");
          let usernameDir = path.join(orgsDir, scratchOrg.username);

          if (!fs.existsSync(usernameDir)) throw new Error(`Failed to consolidate source tracking files. Unable to find ${usernameDir}`);

          let maxRevisionFilePath = path.join(usernameDir, "maxRevision.json");
          let sourcePathInfosFilePath = path.join(usernameDir, "sourcePathInfos.json");

          if (!fs.existsSync(maxRevisionFilePath) || !fs.existsSync(sourcePathInfosFilePath))
            throw new Error(`Failed to consolidate source tracking files. Missing source tracking files`);

          if (fs.existsSync(aggregatedMaxRevisionFilePath) && fs.existsSync(aggregatedSourcePathinfosFilePath)) {

            let aggregatedMaxRevision = fs.readJSONSync(aggregatedMaxRevisionFilePath, {encoding: "UTF-8"});
            let maxRevision = fs.readJSONSync(maxRevisionFilePath, {encoding: "UTF-8"})
            if (maxRevision.serverMaxRevisionCounter >= aggregatedMaxRevision.serverMaxRevisionCounter) {
              // Replace maxRevision.json
              fs.copySync(maxRevisionFilePath, aggregatedMaxRevisionFilePath, { overwrite: true });
            }

            // Concatenate sourcePathInfos.json
            let aggregatedSourcePathInfos = fs.readJSONSync(aggregatedSourcePathinfosFilePath, {encoding: "UTF-8"});
            let sourcePathInfos = fs.readJSONSync(sourcePathInfosFilePath, {encoding: "UTF-8"});

            // truncate source path
            for (let entry of Object.entries<any>(sourcePathInfos)) {
              let newPropName = entry[0].replace(path.resolve(packageInfoOfDeployedArtifact.sourceDirectory), "");
              let newPropValue = lodash.cloneDeep(entry[1]);
              newPropValue.sourcePath = newPropValue.sourcePath.replace(path.resolve(packageInfoOfDeployedArtifact.sourceDirectory), "");

              sourcePathInfos[newPropName] = newPropValue;

              delete sourcePathInfos[entry[0]];
            }

            Object.assign(aggregatedSourcePathInfos, sourcePathInfos)

            fs.writeJSONSync(aggregatedSourcePathinfosFilePath, aggregatedSourcePathInfos, {spaces: 2});
          } else {
            fs.copySync(maxRevisionFilePath, aggregatedMaxRevisionFilePath);
            fs.copySync(sourcePathInfosFilePath, aggregatedSourcePathinfosFilePath);

            let aggregatedSourcePathInfos = fs.readJSONSync(aggregatedSourcePathinfosFilePath, {encoding: "UTF-8"});
            // truncate source path
            for (let entry of Object.entries<any>(aggregatedSourcePathInfos)) {
              let newPropName = entry[0].replace(path.resolve(packageInfoOfDeployedArtifact.sourceDirectory), "");
              let newPropValue = lodash.cloneDeep(entry[1]);
              newPropValue.sourcePath = newPropValue.sourcePath.replace(path.resolve(packageInfoOfDeployedArtifact.sourceDirectory), "");
              aggregatedSourcePathInfos[newPropName] = newPropValue;

              delete aggregatedSourcePathInfos[entry[0]];
            }

            fs.writeJSONSync(aggregatedSourcePathinfosFilePath, aggregatedSourcePathInfos, { spaces: 2 })
          }
        }

        // Deploy static resource to SO
        let projectConfig = {
          packageDirectories: [
            {
              path: "force-app",
              default: true
            }
          ],
          namespace: "",
          sourceApiVersion: "49.0"
        };

        fs.writeJSONSync(path.join(aggregatedUsernameDir, "sfdx-project.json"), projectConfig, { spaces: 2 });
        let staticResourcesDir = path.join(aggregatedUsernameDir, "force-app", "main", "default", "staticresources");
        fs.mkdirpSync(staticResourcesDir);

        let zip = new AdmZip();
        zip.addLocalFile(aggregatedMaxRevisionFilePath);
        zip.addLocalFile(aggregatedSourcePathinfosFilePath);
        zip.writeZip(path.join(staticResourcesDir, "sourceTrackingFiles.zip"));

        let metadataXml: string =
          `<?xml version="1.0" encoding="UTF-8"?>
          <StaticResource xmlns="http://soap.sforce.com/2006/04/metadata">
            <cacheControl>Public</cacheControl>
            <contentType>application/zip</contentType>
          </StaticResource>`;

        fs.writeFileSync(path.join(staticResourcesDir, "sourceTrackingFiles.resource-meta.xml"), metadataXml);

        try {
          child_process.execSync(
            `sfdx force:source:deploy -p force-app -u ${scratchOrg.username}`,
            {
              cwd: aggregatedUsernameDir,
              encoding: 'utf8',
              stdio: 'pipe'
            }
          );
        } catch (error) {
          SFPLogger.log(
            `Failed to deploy static resources to scratch org`,
            null,
            packageLogger
          );
          throw error;
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
      isRetryOnFailure: this.pool.retryOnFailure
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
      deploymentMode: DeploymentMode.SOURCEPACKAGES,
      isRetryOnFailure: this.pool.retryOnFailure,
      artifacts: this.artifacts
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
    scratchOrg: ScratchOrg,
    isRelaxAllIPRanges: boolean,
    relaxIPRanges: string[],
    logger: Logger
  ): Promise<{ username: string; success: boolean }> {
    SFPLogger.log(
      `Relaxing ip ranges for scratchOrg with user ${scratchOrg.username}`,
      LoggerLevel.INFO
    );
    const connection = await Connection.create({
      authInfo: await AuthInfo.create({ username: scratchOrg.username }),
    });

    if (isRelaxAllIPRanges) {
      relaxIPRanges = [];
      return new RelaxIPRange(logger).setIp(
        connection,
        scratchOrg.username,
        relaxIPRanges,
        true
      );
    } else {
      return new RelaxIPRange(logger).setIp(
        connection,
        scratchOrg.username,
        relaxIPRanges
      );
    }
  }
}
