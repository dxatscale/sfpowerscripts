import { ApexClasses } from "../package/SFPPackage";
import { SFDXCommand } from "../SFDXCommand";
import { delay } from "../utils/Delay";
import SFPLogger, { LoggerLevel } from "../utils/SFPLogger";
import DeploymentStatusImpl, { DeploymentStatus } from "./DeploymentStatusImpl";
import { TestLevel } from "./TriggerApexTestImpl";
import { DeploymentCommandStatus } from "./DeploymentCommandStatus";

export type DeploymentOptions = {
  isCheckOnlyDeployment: boolean;
  testLevel: TestLevel;
  specifiedTests?: ApexClasses;
  isIgnoreWarnings: boolean;
  isIgnoreErrors: boolean;
};

export type DeployResult = {
  deploy_id: string;
  status: DeploymentCommandStatus;
  result: any;
};

export default class DeployMDAPIDirToOrgImpl extends SFDXCommand {
  public constructor(
    targetOrg: string,
    projectDirectory: string,
    private mdapiDirectory: string,
    private deploymentOptions: DeploymentOptions,
    logFile?: any,
    logLevel?: LoggerLevel,
    private pollRate:number=30000
  ) {
    super(targetOrg, projectDirectory, logFile, logLevel);
    if(deploymentOptions.testLevel==TestLevel.RunAllTestsInPackage)
    {
      throw new Error("Unsupported option, callers must use provide apex classes");
    }
  }

  public async exec(quiet?: boolean): Promise<DeployResult> {
    //Get Deploy ID
    let deploymentId = "";
    try {
      let resultAsJSON = await super.exec(quiet);
      let result = JSON.parse(resultAsJSON);
      deploymentId = result.result.id;
    } catch (error) {
      let deployResult: DeployResult = {
        deploy_id: deploymentId,
        status: 0,
        result: error,
      };
      return deployResult;
    }

    this.printInitiationHeader();

    let deploymentStatusImpl: DeploymentStatusImpl = new DeploymentStatusImpl(
      this.target_org,
      deploymentId
    );
    await this.waitTillDeploymentIsDone(deploymentStatusImpl, quiet);
    let deploymentStatus: DeploymentStatus = await this.getFinalDeploymentStatus(
      deploymentStatusImpl,
      quiet
    );
    let deployResult: DeployResult = {
      deploy_id: deploymentId,
      status: deploymentStatus.status,
      result: deploymentStatus.result,
    };

    return deployResult;
  }

  private printInitiationHeader() {
    if (this.deploymentOptions.isCheckOnlyDeployment)
      SFPLogger.log(
        `Validation only deployment  is in progress....  Unleashing the power of your code!`,
        null,
        this.logFile
      );
    else
      SFPLogger.log(
        `Deployment is in progress....  Unleashing the power of your code!`,
        null,
        this.logFile
      );
  }

  private  getFinalDeploymentStatus(
    deploymentStatusImpl: DeploymentStatusImpl,
    quiet: boolean
  ): Promise<DeploymentStatus> {
    return deploymentStatusImpl.exec(
      quiet
    );
  
  }

  private async waitTillDeploymentIsDone(
    deploymentStatusImpl: DeploymentStatusImpl,
    quiet: boolean
  ) {
    // Loop till deployment completes to show status
    while (true) {
      try {
        let deploymentStatus: DeploymentStatus = await deploymentStatusImpl.exec(
          quiet
        );

        if (deploymentStatus.status == DeploymentCommandStatus.FAILED) {
          this.printFailureHeader();
          break;
        } else if (
          deploymentStatus.status == DeploymentCommandStatus.INPROGRESS
        ) {
          this.printInProgressDeploymentStatus(deploymentStatus);
        } else if (
          deploymentStatus.status == DeploymentCommandStatus.SUCCEEDED
        ) {
          this.printSuccessHeader();
          break;
        }
      } catch (err) {
        console.log(err);
        break;
      }
      await delay(this.pollRate);
    }
  }

  private printInProgressDeploymentStatus(deploymentStatus: DeploymentStatus) {
    if (
      deploymentStatus.result.numberComponentsDeployed <
      deploymentStatus.result.numberComponentsTotal
    )
      SFPLogger.log(
        `Deploying components ${deploymentStatus.result.numberComponentsDeployed} out of ${deploymentStatus.result.numberComponentsTotal}`,
        null,
        this.logFile
      );
    else
      SFPLogger.log(
        `State: ${deploymentStatus.result.stateDetail}`,
        null,
        this.logFile
      );
  }

  private printFailureHeader() {
    if (this.deploymentOptions.isCheckOnlyDeployment)
      SFPLogger.log(`Validation Failed`, null, this.logFile);
    else SFPLogger.log(`Deployment Failed`, null, this.logFile);
  }

  private printSuccessHeader() {
    if (this.deploymentOptions.isCheckOnlyDeployment)
      SFPLogger.log(`Validation Succeeded`, null, this.logFile);
    else SFPLogger.log(`Deployment Succeeded`, null, this.logFile);
  }

  getCommandName(): string {
    return "DeployMDAPIDirToOrg";
  }
  getGeneratedSFDXCommandWithParams(): string {
    let command = `sfdx force:mdapi:deploy -u ${this.target_org}`;

    if (this.deploymentOptions.isCheckOnlyDeployment) command += ` -c`;

    //directory
    command += ` --deploydir ${this.mdapiDirectory}`;

    //add json
    command += ` --json`;

    if (this.deploymentOptions.testLevel == TestLevel.RunSpecifiedTests) {
      command += ` --testlevel RunSpecifiedTests`;
      let apexclasses = this.deploymentOptions.specifiedTests.toString();
      command += ` --runtests ${apexclasses.toString()}`;
    } else {
      command += ` --testlevel ${this.deploymentOptions.testLevel}`;
    }

    if (this.deploymentOptions.isIgnoreWarnings) {
      command += ` --ignorewarnings`;
    }
    if (this.deploymentOptions.isIgnoreErrors) {
      command += ` --ignoreerrors`;
    }

    return command;
  }
}
