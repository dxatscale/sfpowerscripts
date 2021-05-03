import ReleaseDefinitionSchema from "./ReleaseDefinitionSchema";
import FetchImpl from "../artifacts/FetchImpl";
import DeployImpl, { DeployProps , DeploymentMode, DeploymentResult } from "../deploy/DeployImpl";
import SFPLogger, { LoggerLevel } from "@dxatscale/sfpowerscripts.core/lib/utils/SFPLogger";
import { Stage } from "../Stage";
import child_process = require("child_process");
import ReleaseError from "../../errors/ReleaseError";
import ChangelogImpl from "../../impl/changelog/ChangelogImpl";


export default class ReleaseImpl {
  constructor(
    private releaseDefinition: ReleaseDefinitionSchema,
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
    private isGenerateChangelog: boolean,
    private isCheckIfPackagesPromoted: boolean
  ){}

  public async exec(): Promise<ReleaseResult> {

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

    let installDependenciesResult: InstallDependenciesResult;
    if (this.releaseDefinition.packageDependencies) {
      installDependenciesResult = this.installPackageDependencies(
        this.releaseDefinition.packageDependencies,
        this.targetOrg,
        this.keys,
        this.waitTime
      );
    }

    let deploymentResult = await this.deployArtifacts(this.releaseDefinition);

    if (deploymentResult.failed.length > 0 || deploymentResult.error) {
      throw new ReleaseError(
        "Deployment failed",
        {deploymentResult: deploymentResult, installDependenciesResult: installDependenciesResult}
      );
    } else {
      if (this.isGenerateChangelog) {
        this.printOpenLoggingGroup("Release changelog");

        let changelogImpl: ChangelogImpl = new ChangelogImpl(
          "artifacts",
          this.releaseDefinition.release,
          this.releaseDefinition.changelog.workItemFilter,
          this.releaseDefinition.changelog.repoUrl,
          this.releaseDefinition.changelog.limit,
          this.releaseDefinition.changelog.workItemUrl,
          this.releaseDefinition.changelog.showAllArtifacts,
          false,
          this.targetOrg
        );

        await changelogImpl.exec();


        this.printClosingLoggingGroup();
      }

      return {
        deploymentResult: deploymentResult,
        installDependenciesResult: installDependenciesResult
      }
    }
  }

  private async deployArtifacts(
    releaseDefinition: ReleaseDefinitionSchema
  ) {

    let deployProps: DeployProps = {
      targetUsername: this.targetOrg,
      artifactDir: "artifacts",
      waitTime: this.waitTime,
      tags: this.tags,
      isTestsToBeTriggered: false,
      deploymentMode: DeploymentMode.NORMAL,
      skipIfPackageInstalled: releaseDefinition.skipIfAlreadyInstalled,
      logsGroupSymbol: this.logsGroupSymbol,
      currentStage: Stage.DEPLOY,
      baselineOrg: releaseDefinition.baselineOrg,
      isCheckIfPackagesPromoted: this.isCheckIfPackagesPromoted,
      isDryRun: this.isDryRun
    };

    let deployImpl: DeployImpl = new DeployImpl(
      deployProps
    );

    let deploymentResult = await deployImpl.exec();

    return deploymentResult;
  }

  private installPackageDependencies(
    packageDependencies: {[p:string]: string},
    targetOrg: string,
    keys: string,
    waitTime: number
  ): InstallDependenciesResult {
    let result: InstallDependenciesResult = {
      success: [],
      skipped: [],
      failed: []
    };

    this.printOpenLoggingGroup("Installing package dependencies");

    try {
      let packagesToKeys: {[p: string]: string};
      if (keys) {
        packagesToKeys = this.parseKeys(keys);
      }

      // print packages dependencies to install

      for (let pkg in packageDependencies) {
        if (!this.isPackageInstalledInOrg(packageDependencies[pkg], targetOrg)) {
          let cmd = `sfdx force:package:install -p ${packageDependencies[pkg]} -u ${targetOrg} -w ${waitTime} -b ${waitTime} --noprompt`;

          if (packagesToKeys?.[pkg])
            cmd += ` -k ${packagesToKeys[pkg]}`;

          SFPLogger.log(
            `Installing package dependency ${pkg}: ${packageDependencies[pkg]}`,
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
          result.success.push([pkg, packageDependencies[pkg]]);
        } else {
          result.skipped.push([pkg, packageDependencies[pkg]]);
          console.log(`Package dependency ${pkg}: ${packageDependencies[pkg]} is already installed in target org`);
          continue;
        }
      }

      this.printClosingLoggingGroup();
      return result;
    } catch (err) {
      console.log(err.message);

      throw new ReleaseError(
        "Failed to install package dependencies",
        {installDependenciesResult: result, deploymentResult: null},
        err
      );
    }
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

type PackageInfo = {
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

interface InstallDependenciesResult {
  success: [string, string][],
  skipped: [string, string][],
  failed: [string, string][]
}

export interface ReleaseResult {
  deploymentResult: DeploymentResult,
  installDependenciesResult: InstallDependenciesResult
}
