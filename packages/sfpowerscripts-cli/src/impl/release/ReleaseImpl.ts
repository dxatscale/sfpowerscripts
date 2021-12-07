import ReleaseDefinitionSchema from "./ReleaseDefinitionSchema";
import FetchImpl from "../artifacts/FetchImpl";
import DeployImpl, { DeployProps , DeploymentMode, DeploymentResult } from "../deploy/DeployImpl";
import SFPLogger, { LoggerLevel } from "@dxatscale/sfpowerscripts.core/lib/logger/SFPLogger";
import { Stage } from "../Stage";
import child_process = require("child_process");
import ReleaseError from "../../errors/ReleaseError";
import ChangelogImpl from "../../impl/changelog/ChangelogImpl";
import { Org } from "@salesforce/core";
import SFPStatsSender from "@dxatscale/sfpowerscripts.core/lib/stats/SFPStatsSender";
import { Release } from "../changelog/ReleaseChangelogInterfaces";
import InstalledPackagesFetcher from "@dxatscale/sfpowerscripts.core/lib/package/packageQuery/InstalledPackagesFetcher";

export interface ReleaseProps
{
  releaseDefinition: ReleaseDefinitionSchema,
  targetOrg: string,
  fetchArtifactScript: string,
  isNpm: boolean,
  scope: string,
  npmrcPath: string,
  logsGroupSymbol: string[],
  tags: any,
  isDryRun: boolean,
  waitTime: number,
  keys: string,
  isGenerateChangelog: boolean,
  devhubUserName: string,
  branch:string
}


export default class ReleaseImpl {

  constructor(
    private props: ReleaseProps
  ){}

  public async exec(): Promise<ReleaseResult> {

    this.printOpenLoggingGroup("Fetching artifacts");
    let fetchImpl: FetchImpl = new FetchImpl(
      this.props.releaseDefinition,
      "artifacts",
      this.props.fetchArtifactScript,
      this.props.isNpm,
      this.props.scope,
      this.props.npmrcPath
    );
    await fetchImpl.exec();
    this.printClosingLoggingGroup();


    let installDependenciesResult: InstallDependenciesResult;
    if (this.props.releaseDefinition.packageDependencies) {
      installDependenciesResult = await this.installPackageDependencies(
        this.props.releaseDefinition.packageDependencies,
        this.props.targetOrg,
        this.props.keys,
        this.props.waitTime
      );
    }

    let deploymentResult = await this.deployArtifacts(this.props.releaseDefinition);

    if (deploymentResult.failed.length > 0 || deploymentResult.error) {
      throw new ReleaseError(
        "Deployment failed",
        {deploymentResult: deploymentResult, installDependenciesResult: installDependenciesResult}
      );
    } else {
      if (this.props.isGenerateChangelog) {
        this.printOpenLoggingGroup("Release changelog");

        let changelogImpl: ChangelogImpl = new ChangelogImpl(
          "artifacts",
          this.props.releaseDefinition.release,
          this.props.releaseDefinition.changelog.workItemFilter,
          this.props.releaseDefinition.changelog.limit,
          this.props.releaseDefinition.changelog.workItemUrl,
          this.props.releaseDefinition.changelog.showAllArtifacts,
          false,
          this.props.branch,
          this.props.isDryRun,
          this.props.targetOrg
        );

        let releaseChangelog = await changelogImpl.exec();

        const aggregatedNumberOfWorkItemsInRelease = this.getAggregatedNumberOfWorkItemsInRelease(releaseChangelog.releases);

        SFPStatsSender.logGauge(
          "release.workitems",
          aggregatedNumberOfWorkItemsInRelease,
          {releaseName: this.props.releaseDefinition.release}
        );

        const aggregatedNumberOfCommitsInRelease = this.getAggregatedNumberOfCommitsInRelease(releaseChangelog.releases);

        SFPStatsSender.logGauge(
          "release.commits",
          aggregatedNumberOfCommitsInRelease,
          {releaseName: this.props.releaseDefinition.release}
        );

        this.printClosingLoggingGroup();
      }

      return {
        deploymentResult: deploymentResult,
        installDependenciesResult: installDependenciesResult
      }
    }
  }

  /**
   *
   * @param releases
   * @returns aggregated number of work items in a release
   */
  private getAggregatedNumberOfWorkItemsInRelease(releases: Release[]) {
    let aggregatedNumberOfWorkItemsInRelease: number = 0;
    releases.forEach(release => {
      if (release.names.includes(this.props.releaseDefinition.release)) {
        aggregatedNumberOfWorkItemsInRelease += this.getNumberOfWorkItems(release);
      }
    });
    return aggregatedNumberOfWorkItemsInRelease;
  }

  /**
   *
   * @param releases
   * @returns aggregated number of commits in a release
   */
  private getAggregatedNumberOfCommitsInRelease(releases: Release[]) {
    let aggregatedNumberOfCommitsInRelease: number = 0;
    releases.forEach(release => {
      if (release.names.includes(this.props.releaseDefinition.release)) {
        aggregatedNumberOfCommitsInRelease += this.getNumberOfCommits(release);
      }
    })
    return aggregatedNumberOfCommitsInRelease;
  }

  private getNumberOfWorkItems(release: Release) {
    return Object.keys(release.workItems).length;
  }

  private getNumberOfCommits(release: Release) {
    let numberOfCommits: number = 0;

    release.artifacts.forEach((artifact) => {numberOfCommits += artifact.commits.length});

    return numberOfCommits;
  }

  private async deployArtifacts(
    releaseDefinition: ReleaseDefinitionSchema
  ) {

    let deployProps: DeployProps = {
      targetUsername: this.props.targetOrg,
      artifactDir: "artifacts",
      waitTime: this.props.waitTime,
      tags: this.props.tags,
      isTestsToBeTriggered: false,
      deploymentMode: DeploymentMode.NORMAL,
      skipIfPackageInstalled: releaseDefinition.skipIfAlreadyInstalled,
      logsGroupSymbol: this.props.logsGroupSymbol,
      currentStage: Stage.DEPLOY,
      baselineOrg: releaseDefinition.baselineOrg,
      isDryRun: this.props.isDryRun,
      promotePackagesBeforeDeploymentToOrg: releaseDefinition.promotePackagesBeforeDeploymentToOrg,
      devhubUserName: this.props.devhubUserName
    };

    let deployImpl: DeployImpl = new DeployImpl(
      deployProps
    );

    let deploymentResult = await deployImpl.exec();

    return deploymentResult;
  }

  private async installPackageDependencies(
    packageDependencies: { [p: string]: string },
    targetOrg: string,
    keys: string,
    waitTime: number
  ): Promise<InstallDependenciesResult> {
    let result: InstallDependenciesResult = {
      success: [],
      skipped: [],
      failed: [],
    };

    this.printOpenLoggingGroup("Installing package dependencies");

    try {
      let packagesToKeys: { [p: string]: string };
      if (keys) {
        packagesToKeys = this.parseKeys(keys);
      }

      // print packages dependencies to install

      for (let pkg in packageDependencies) {
        if (
          !(await this.isPackageInstalledInOrg(
            packageDependencies[pkg],
            targetOrg
          ))
        ) {
          if (this.props.isDryRun) {
            SFPLogger.log(`Package Dependency ${packageDependencies[pkg]} will be installed`,LoggerLevel.INFO)
          } else {
            let cmd = `sfdx force:package:install -p ${packageDependencies[pkg]} -u ${targetOrg} -w ${waitTime} -b ${waitTime} --noprompt`;

            if (packagesToKeys?.[pkg]) cmd += ` -k ${packagesToKeys[pkg]}`;

            SFPLogger.log(
              `Installing package dependency ${pkg}: ${packageDependencies[pkg]}`,
              LoggerLevel.INFO
            );
            child_process.execSync(cmd, {
              stdio: "inherit",
            });
            result.success.push([pkg, packageDependencies[pkg]]);
          }
        } else {
          result.skipped.push([pkg, packageDependencies[pkg]]);
          SFPLogger.log(
            `Package dependency ${pkg}: ${packageDependencies[pkg]} is already installed in target org`
          );
          continue;
        }
      }

      this.printClosingLoggingGroup();
      return result;
    } catch (err) {
      console.log(err.message);

      throw new ReleaseError(
        "Failed to install package dependencies",
        { installDependenciesResult: result, deploymentResult: null },
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

  private async isPackageInstalledInOrg(packageVersionId: string, targetUsername: string): Promise<boolean> {
    try {
      let conn = (await Org.create({aliasOrUsername: targetUsername})).getConnection(); // TODO: REFACTOR CLASS TO TAKE CONNECTION IN CONSTRUCTOR

      SFPLogger.log(`Checking Whether Package with ID ${packageVersionId} is installed in  ${targetUsername}`);
      let installedPackages = await new InstalledPackagesFetcher(conn).fetchAllPackages();

      let packageFound = installedPackages.find((installedPackage) => {
        return installedPackage.subscriberPackageVersionId === packageVersionId
      });

      return packageFound ? true : false;
    } catch (error) {
      SFPLogger.log(
        "Unable to check whether this package is installed in the target org");
      return false;
    }
  }

  private printOpenLoggingGroup(message:string) {
    if (this.props.logsGroupSymbol?.[0])
      SFPLogger.log(
        `${this.props.logsGroupSymbol[0]} ${message}`,
        LoggerLevel.INFO
      );
  }

  private printClosingLoggingGroup() {
    if (this.props.logsGroupSymbol?.[1])
      SFPLogger.log(
        this.props.logsGroupSymbol[1],
        LoggerLevel.INFO
      );
  }
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
