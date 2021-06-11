
import InstallPackageDependenciesImpl from "@dxatscale/sfpowerscripts.core/lib/sfdxwrappers/InstallPackageDependenciesImpl";
import { PackageInstallationStatus } from "@dxatscale/sfpowerscripts.core/lib/package/PackageInstallationResult";
import * as fs from "fs-extra";
import DeployImpl, { DeploymentMode, DeployProps } from "../../deploy/DeployImpl";
import { EOL } from "os";
import SFPLogger, {
  LoggerLevel,
} from "@dxatscale/sfpowerscripts.core/lib/logger/SFPLogger";
import { Stage } from "../../Stage";
import SFPStatsSender from "@dxatscale/sfpowerscripts.core/lib/stats/SFPStatsSender";
import InstallUnlockedPackageImpl from "@dxatscale/sfpowerscripts.core/lib/sfdxwrappers/InstallUnlockedPackageImpl"
import ScratchOrg from "../../pool/ScratchOrg";
import { ScriptExecutionResult }  from "../../pool/PoolJobExecutor";
import { Org } from "@salesforce/core";
import ProjectConfig from "@dxatscale/sfpowerscripts.core/lib/project/ProjectConfig";
import { PoolConfig } from "../../pool/PoolConfig";

const SFPOWERSCRIPTS_ARTIFACT_PACKAGE = "04t1P000000ka9mQAA";
export default class PrepareASingleOrgImpl {
  private keys;
  private installAll: boolean;
  private installAsSourcePackages: boolean;
  private succeedOnDeploymentErrors: boolean;
  private checkPointPackages: string[];

  public constructor(
    private pool:PoolConfig
  ) {}



  public async execute(scratchOrg:ScratchOrg,hubOrg:Org): Promise<ScriptExecutionResult> {
    //Install sfpowerscripts Artifact

    try {

      this.checkPointPackages=this.getcheckPointPackages();

      //Create file logger
      fs.outputFileSync(
        `.sfpowerscripts/prepare_logs/${scratchOrg.alias}.log`,
        `sfpowerscripts--log${EOL}`
      );

      let packageLogger: any = `.sfpowerscripts/prepare_logs/${scratchOrg.alias}.log`;
      SFPLogger.log(
        `Installing sfpowerscripts_artifact package to the ${scratchOrg.alias}`,
        null,
        packageLogger
      );

      let installUnlockedPackageImpl:InstallUnlockedPackageImpl = new InstallUnlockedPackageImpl(null,
               scratchOrg.username,
               process.env.SFPOWERSCRIPTS_ARTIFACT_PACKAGE
          ? process.env.SFPOWERSCRIPTS_ARTIFACT_PACKAGE
          : SFPOWERSCRIPTS_ARTIFACT_PACKAGE,
           "60");

     await installUnlockedPackageImpl.exec(true);


      let startTime = Date.now();
      SFPLogger.log(
        `Installing package depedencies to the ${scratchOrg.alias}`,
        null,
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

      console.log(
        `Successfully completed Installing Package Dependencies of this repo in ${scratchOrg.alias}`
      );

      if (this.pool.cipool.installAll) {
        let deploymentResult = await this.deployAllPackagesInTheRepo(
          scratchOrg,
          packageLogger
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
      } else {
        //Send succeeded metrics when everything is in when no install is activated
        SFPStatsSender.logCount("prepare.org.succeeded");
      }

      return {
        status: "success",
        isSuccess: true,
        message: "Succesfully Created Scratch Org",
        scratchOrgUsername: scratchOrg.username,
      };
    } catch (error) {
      SFPStatsSender.logCount("prepare.org.failed");
      return {
        status: "failure",
        isSuccess: false,
        message: error.message,
        scratchOrgUsername: scratchOrg.username,
      };
    }
  }

  private async deployAllPackagesInTheRepo(scratchOrg:ScratchOrg,packageLogger: any) {
    SFPLogger.log(
      `Deploying all packages in the repo to  ${scratchOrg.alias}`
    );
    SFPLogger.log(
      `Deploying all packages in the repo to  ${scratchOrg.alias}`,
      null,
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
      deploymentMode: this.pool.cipool.installAsSourcePackages
        ? DeploymentMode.SOURCEPACKAGES
        : DeploymentMode.NORMAL,
      isRetryOnFailure: this.pool.cipool.retryOnFailure,
    };

    //Deploy the fetched artifacts to the org
    let deployImpl: DeployImpl = new DeployImpl(deployProps);

    let deploymentResult = await deployImpl.exec();

    return deploymentResult;
  }

  private handleDeploymentErrorsForFullDeployment(
    scratchOrg:ScratchOrg,
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
        packageLogger,
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
    } else {
      //All good send succeeded metrics
      SFPStatsSender.logCount("prepare.org.succeeded");
    }
  }

  private handleDeploymentErrorsForPartialDeployment(
    scratchOrg:ScratchOrg,
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
    } else {
      //All good send succeeded metrics
      SFPStatsSender.logCount("prepare.org.succeeded");
    }
  }

   //Fetch all checkpoints
   private getcheckPointPackages() {
    console.log("Fetching checkpoints for prepare if any.....");
    let projectConfig = ProjectConfig.getSFDXPackageManifest(null);
    let checkPointPackages = [];
    projectConfig["packageDirectories"].forEach((pkg) => {
      if (pkg.checkpointForPrepare) checkPointPackages.push(pkg["package"]);
    });
    return checkPointPackages;
  }
}


