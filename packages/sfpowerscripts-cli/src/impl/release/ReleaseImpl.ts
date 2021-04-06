import ReleaseDefinitionI from "./ReleaseDefinitionInterface";
import FetchImpl from "../artifacts/FetchImpl";
import DeployImpl, { DeployProps , DeploymentMode } from "../deploy/DeployImpl";
import SFPLogger, { LoggerLevel } from "@dxatscale/sfpowerscripts.core/lib/utils/SFPLogger";
import { Stage } from "../Stage";
import get18DigitSalesforceId from "../../utils/get18DigitSalesforceId";
import child_process = require("child_process");


export default class ReleaseImpl {
  constructor(
    private releaseDefinition: ReleaseDefinitionI,
    private targetOrg: string,
    private fetchArtifactScript: string,
    private isNpm: boolean,
    private scope: string,
    private npmrcPath: string,
    private logsGroupSymbol: string[],
    private tags: any,
    private isDryRun: boolean,
    private waitTime: number,
    private keys: string,
    private isCheckIfPackagesPromoted: boolean
  ){}

  public async exec(): Promise<boolean> {

    this.printOpenLoggingGroup("Fetching artifacts");
    let fetchImpl: FetchImpl = new FetchImpl(
      this.releaseDefinition,
      "artifacts",
      this.fetchArtifactScript,
      this.isNpm,
      this.scope,
      this.npmrcPath
    );
    await fetchImpl.exec();
    this.printClosingLoggingGroup();


    if (this.releaseDefinition.packageDependencies) {
      this.installPackageDependencies(
        this.releaseDefinition.packageDependencies,
        this.targetOrg,
        this.keys,
        this.waitTime
      );
    }

    let deploymentResult = await this.deployArtifacts(this.releaseDefinition);

    if (deploymentResult.failed.length > 0 || deploymentResult.error) {
      return false
    } else {
      return true
    }
  }

  private async deployArtifacts(
    releaseDefinition: ReleaseDefinitionI
  ) {
    let deployStartTime: number = Date.now();

    let deployProps: DeployProps = {
      targetUsername: this.targetOrg,
      artifactDir: "artifacts",
      waitTime: this.waitTime,
      tags: this.tags,
      isTestsToBeTriggered: false,
      deploymentMode: DeploymentMode.NORMAL,
      skipIfPackageInstalled: releaseDefinition.releaseOptions?.skipIfAlreadyInstalled,
      logsGroupSymbol: this.logsGroupSymbol,
      currentStage: Stage.DEPLOY,
      baselineOrg: releaseDefinition.releaseOptions?.baselineOrg,
      isCheckIfPackagesPromoted: this.isCheckIfPackagesPromoted,
      isDryRun: this.isDryRun
    };

    let deployImpl: DeployImpl = new DeployImpl(
      deployProps
    );

    let deploymentResult = await deployImpl.exec();

    let deploymentElapsedTime: number = Date.now() - deployStartTime;

    this.printDeploySummary(deploymentResult, deploymentElapsedTime);
    return deploymentResult;
  }

  private installPackageDependencies(
    packageDependencies: {[p:string]: string},
    targetOrg: string,
    keys: string,
    waitTime: number
  ) {
    this.printOpenLoggingGroup("Installing package dependencies");

    let packagesToKeys: {[p: string]: string};
    if (keys) {
      packagesToKeys = this.parseKeys(keys);
    }

    for (let pkg in packageDependencies) {
      let packageVersionId = get18DigitSalesforceId(packageDependencies[pkg]);
      if (!this.isPackageInstalledInOrg(packageVersionId, targetOrg)) {
        let cmd = `sfdx force:package:install -p ${packageVersionId} -u ${targetOrg} -w ${waitTime} -b ${waitTime} --noprompt`;

        if (packagesToKeys?.[pkg])
          cmd += ` -k ${packagesToKeys[pkg]}`;

        SFPLogger.log(
          `Installing package dependency ${pkg}: ${packageVersionId}`,
          null,
          null,
          LoggerLevel.INFO
        );
        child_process.execSync(
          cmd,
          {
            stdio: 'inherit'
          }
        );
      } else {
        console.log(`Package dependency ${pkg}: ${packageVersionId} is already installed in target org`);
        continue;
      }
    }
    this.printClosingLoggingGroup();
  }

  /**
   * Parse keys in string format "packageA:key packageB:key packageC:key"
   * Returns map of packages to keys
   * @param keys
   */
  private parseKeys(
    keys: string
  ) {
    let output: {[p: string]: string} = {};

    keys = keys.trim();
    let listOfKeys = keys.split(" ");

    for (let key of listOfKeys) {
      let packageKeyPair = key.split(":");
      if (packageKeyPair.length === 2) {
        output[packageKeyPair[0]] = packageKeyPair[1];
      } else {
        // Format is incorrect, throw an error
        throw new Error(
          `Error parsing keys, format should be: "packageA:key packageB:key packageC:key"`
        );
      }
    }

    return output;
  }

  private isPackageInstalledInOrg(packageVersionId: string, targetUsername: string): boolean {
    try {
      SFPLogger.log(`Checking Whether Package with ID ${packageVersionId} is installed in  ${targetUsername}`);
      let command = `sfdx sfpowerkit:package:version:info  -u ${targetUsername} --json`;
      let result = JSON.parse(child_process.execSync(command).toString());
      if (result.status === 0) {
        let packageInfos: PackageInfo[] = result.result;
        let packageFound = packageInfos.find((packageInfo) => {
          return packageInfo.packageVersionId === packageVersionId
        });
        return packageFound ? true : false;
      } else throw new Error("Unable to query packages installed in org");
    } catch (error) {
      SFPLogger.log(
        "Unable to check whether this package is installed in the target org");
      return false;
    }
  }

  private printDeploySummary(
    deploymentResult: {deployed: string[], failed: string[], testFailure: string, error: any},
    totalElapsedTime: number
  ): void {
    if (this.logsGroupSymbol?.[0])
      console.log(this.logsGroupSymbol[0], "Deployment Summary");

    console.log(
      `----------------------------------------------------------------------------------------------------`
    );
    console.log(
      `${deploymentResult.deployed.length} packages deployed in ${new Date(totalElapsedTime).toISOString().substr(11,8)
      } with {${deploymentResult.failed.length}} failed deployments`
    );

    if (deploymentResult.failed.length > 0) {
      console.log(`\nPackages Failed to Deploy`, deploymentResult.failed);
    }
    console.log(
      `----------------------------------------------------------------------------------------------------`
    );
    this.printClosingLoggingGroup();
  }

  private printOpenLoggingGroup(message:string) {
    if (this.logsGroupSymbol?.[0])
      SFPLogger.log(
        this.logsGroupSymbol[0],
        `${message}`,
        null,
        LoggerLevel.INFO
      );
  }

  private printClosingLoggingGroup() {
    if (this.logsGroupSymbol?.[1])
      SFPLogger.log(
        this.logsGroupSymbol[1],
        null,
        null,
        LoggerLevel.INFO
      );
  }
}

type PackageInfo= {
  packageName: string;
  subcriberPackageId: string;
  packageNamespacePrefix: string;
  packageVersionId: string;
  packageVersionNumber: string;
  allowedLicenses: number;
  usedLicenses: number;
  expirationDate: string;
  status: string;
}
