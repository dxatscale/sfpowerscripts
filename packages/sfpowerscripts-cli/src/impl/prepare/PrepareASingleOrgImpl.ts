import { SfdxApi } from "../pool/sfdxnode/types";
import { ScratchOrg } from "../pool/utils/ScratchOrgUtils";
import InstallPackageDependenciesImpl from "@dxatscale/sfpowerscripts.core/lib/sfdxwrappers/InstallPackageDependenciesImpl";
import { PackageInstallationStatus } from "@dxatscale/sfpowerscripts.core/lib/package/PackageInstallationResult";
import * as fs from "fs-extra";
import DeployImpl, { DeploymentMode, DeployProps } from "../deploy/DeployImpl";
import { EOL } from "os";
import SFPLogger, {
  LoggerLevel,
} from "@dxatscale/sfpowerscripts.core/lib/utils/SFPLogger";
import { Stage } from "../Stage";
import SFPStatsSender from "@dxatscale/sfpowerscripts.core/lib/utils/SFPStatsSender";

const SFPOWERSCRIPTS_ARTIFACT_PACKAGE = "04t1P000000ka9mQAA";
export default class PrepareASingleOrgImpl {
  private keys;
  private installAll: boolean;
  private installAsSourcePackages: boolean;
  private succeedOnDeploymentErrors: boolean;
  private checkPointPackages: string[];

  public constructor(
    private sfdx: SfdxApi,
    private scratchOrg: ScratchOrg,
    private hubOrg: string,
    private isRetryOnFailure?: boolean
  ) {}

  public setPackageKeys(keys: string) {
    this.keys = keys;
  }

  public setcheckPointPackages(checkPointPackages: string[]) {
    this.checkPointPackages = checkPointPackages;
  }
  public setInstallationBehaviour(
    installAll: boolean,
    installAsSourcePackages: boolean,
    succeedOnDeploymentErrors: boolean
  ) {
    this.installAll = installAll;
    this.installAsSourcePackages = installAsSourcePackages;
    this.succeedOnDeploymentErrors = succeedOnDeploymentErrors;
  }

  public async prepare(): Promise<ScriptExecutionResult> {
    //Install sfpowerscripts Artifact

    try {
      //Create file logger
      fs.outputFileSync(
        `.sfpowerscripts/prepare_logs/${this.scratchOrg.alias}.log`,
        `sfpowerscripts--log${EOL}`
      );

      let packageLogger: any = `.sfpowerscripts/prepare_logs/${this.scratchOrg.alias}.log`;
      SFPLogger.log(
        `Installing sfpowerscripts_artifact package to the ${this.scratchOrg.alias}`,
        null,
        packageLogger
      );

      await this.sfdx.force.package.install({
        quiet: true,
        targetusername: this.scratchOrg.username,
        package: process.env.SFPOWERSCRIPTS_ARTIFACT_PACKAGE
          ? process.env.SFPOWERSCRIPTS_ARTIFACT_PACKAGE
          : SFPOWERSCRIPTS_ARTIFACT_PACKAGE,
        apexcompile: "package",
        noprompt: true,
        wait: 60,
      });

      SFPLogger.isSupressLogs = true;
      let startTime = Date.now();
      SFPLogger.log(
        `Installing package depedencies to the ${this.scratchOrg.alias}`,
        null,
        packageLogger
      );
      SFPLogger.log(
        `Installing Package Dependencies of this repo in ${this.scratchOrg.alias}`
      );

      // Install Dependencies
      let installDependencies: InstallPackageDependenciesImpl = new InstallPackageDependenciesImpl(
        this.scratchOrg.username,
        this.hubOrg,
        120,
        null,
        this.keys,
        true,
        packageLogger
      );
      let installationResult = await installDependencies.exec();
      if (installationResult.result == PackageInstallationStatus.Failed) {
        throw new Error(installationResult.message);
      }

      console.log(
        `Successfully completed Installing Package Dependencies of this repo in ${this.scratchOrg.alias}`
      );

      if (this.installAll) {
        let deploymentResult = await this.deployAllPackagesInTheRepo(
          packageLogger
        );
        this.succeedOnDeploymentErrors
          ? this.handleDeploymentErrorsForPartialDeployment(
              deploymentResult,
              packageLogger
            )
          : this.handleDeploymentErrorsForFullDeployment(
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
        scratchOrgUsername: this.scratchOrg.username,
      };
    } catch (error) {
      SFPStatsSender.logCount("prepare.org.failed");
      return {
        status: "failure",
        isSuccess: false,
        message: error.message,
        scratchOrgUsername: this.scratchOrg.username,
      };
    }
  }

  private async deployAllPackagesInTheRepo(packageLogger: any) {
    SFPLogger.log(
      `Deploying all packages in the repo to  ${this.scratchOrg.alias}`
    );
    SFPLogger.log(
      `Deploying all packages in the repo to  ${this.scratchOrg.alias}`,
      null,
      packageLogger
    );

    let deployProps: DeployProps = {
      targetUsername: this.scratchOrg.username,
      artifactDir: "artifacts",
      waitTime: 120,
      currentStage: Stage.PREPARE,
      packageLogger: packageLogger,
      isTestsToBeTriggered: false,
      skipIfPackageInstalled: false,
      deploymentMode: this.installAsSourcePackages
        ? DeploymentMode.SOURCEPACKAGES
        : DeploymentMode.NORMAL,
      isRetryOnFailure: this.isRetryOnFailure,
    };

    //Deploy the fetched artifacts to the org
    let deployImpl: DeployImpl = new DeployImpl(deployProps);

    let deploymentResult = await deployImpl.exec();

    return deploymentResult;
  }

  private handleDeploymentErrorsForFullDeployment(
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
        `Following Packages failed to deploy in ${this.scratchOrg.alias}`,
        null,
        packageLogger,
        LoggerLevel.INFO
      );
      SFPLogger.log(
        deploymentResult.failed,
        null,
        packageLogger,
        LoggerLevel.INFO
      );
      SFPLogger.log(
        `Deployment of packages failed in ${this.scratchOrg.alias}, this scratch org will be deleted`,
        null,
        packageLogger,
        LoggerLevel.INFO
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
            `One or some of the check point packages ${this.checkPointPackages} failed to deploy, Deleting ${this.scratchOrg.alias}`,
            null,
            packageLogger,
            LoggerLevel.INFO
          );
          throw new Error(
            `One or some of the check point Packages ${this.checkPointPackages} failed to deploy`
          );
        }
      } else {
        SFPStatsSender.logCount("prepare.org.partial");
        SFPLogger.log(
          `Cancelling any further packages to be deployed, Adding the scratchorg ${this.scratchOrg.alias} to the pool`,
          null,
          packageLogger,
          LoggerLevel.INFO
        );
      }
    } else {
      //All good send succeeded metrics
      SFPStatsSender.logCount("prepare.org.succeeded");
    }
  }
}

export interface ScriptExecutionResult {
  status: string;
  message: string;
  scratchOrgUsername: string;
  isSuccess: boolean;
}
