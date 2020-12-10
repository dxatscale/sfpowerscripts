import ArtifactFilePathFetcher from "@dxatscale/sfpowerscripts.core/src/artifacts/ArtifactFilePathFetcher";
import simplegit, { SimpleGit } from "simple-git/promise";
import PackageMetadata from "@dxatscale/sfpowerscripts.core/src/PackageMetadata";
import ManifestHelpers from "@dxatscale/sfpowerscripts.core/src/manifest/ManifestHelpers";
import InstallSourcePackageImpl from "@dxatscale/sfpowerscripts.core/src/sfdxwrappers/InstallSourcePackageImpl";
import InstallDataPackageImpl from "@dxatscale/sfpowerscripts.core/src/sfdxwrappers/InstallDataPackageImpl";
import InstallUnlockedPackageImpl from "@dxatscale/sfpowerscripts.core/src/sfdxwrappers/InstallUnlockedPackageImpl";
import TriggerApexTestImpl from "@dxatscale/sfpowerscripts.core/src/sfdxwrappers/TriggerApexTestImpl";
import SFPStatsSender from "@dxatscale/sfpowerscripts.core/src/utils/SFPStatsSender";
import fs = require("fs");
import path = require("path");
import {
  PackageInstallationResult,
  PackageInstallationStatus,
} from "@dxatscale/sfpowerscripts.core/src/package/PackageInstallationResult";
import SFPLogger, { LoggerLevel } from "@dxatscale/sfpowerscripts.core/src/utils/SFPLogger";
import { EOL } from "os";
import { Stage } from "../Stage";

export enum DeploymentMode {
  NORMAL,
  SOURCEPACKAGES,
}

export default class DeployImpl {
  private logsGroupSymbol: string[];
  private deploymentMode: DeploymentMode=DeploymentMode.NORMAL;
  private coverageThreshold: number=75;
  private isTestsToBeTriggered: boolean=false;
  private skip_if_package_installed: boolean = true;
  private isValidateArtifactsOnHead: boolean = true;

  constructor(
    private targetusername: string,
    private artifactDir: string,
    private wait_time: string,
    private tags: any,
    private packageLogger?: any
  ) {}

  public setDeploymentMode(deploymentMode: DeploymentMode) {
    this.deploymentMode = deploymentMode;
  }

  public activateApexUnitTests(isTestsToBeTriggered: boolean) {
    this.isTestsToBeTriggered = isTestsToBeTriggered;
  }

  public setCoverageThreshold(coverageThreshold: number) {
    this.coverageThreshold = coverageThreshold;
  }

  //Set CI/CD specific log symbols for folding
  public setLogSymbols(logsGroupSymbol: string[]) {
    this.logsGroupSymbol = logsGroupSymbol;
  }

  public skipIfPackageExistsInTheOrg(skip_if_package_installed: boolean) {
    this.skip_if_package_installed = skip_if_package_installed;
  }

  public setIsValidateArtifactsOnHead(isValidateArtifactsOnHead: boolean) {
    this.isValidateArtifactsOnHead = isValidateArtifactsOnHead;
  }

  public async exec(): Promise<{
    deployed: string[];
    skipped: string[];
    failed: string[];
  }> {
    let deployed: string[] = [];
    let skipped: string[] = [];
    let failed: string[] = [];

    try {
      let queue: any[] = this.getPackagesToDeploy();

      SFPStatsSender.logGauge("deploy.scheduled", queue.length, this.tags);

      SFPLogger.log(
        `Packages to be deployed:`,
        queue.map((pkg) => pkg.package),
        this.packageLogger,
        LoggerLevel.INFO
      );

      if (this.isValidateArtifactsOnHead)
        await this.validateArtifacts();

      for (let i = 0; i < queue.length; i++) {



        let artifacts = ArtifactFilePathFetcher.fetchArtifactFilePaths(
          this.artifactDir,
          queue[i].package
        );

        let packageMetadata: PackageMetadata = JSON.parse(
          fs.readFileSync(artifacts[0].packageMetadataFilePath, "utf8")
        );

        let packageType: string = packageMetadata.package_type;

        if (this.logsGroupSymbol?.[0])
          SFPLogger.log(
            this.logsGroupSymbol[0],
            "Installing",
            queue[i].package,
            LoggerLevel.INFO
          );

        let isApexFoundMessage: string =
          packageMetadata.package_type === "unlocked"
            ? ""
            : `Contains Apex Classes/Triggers: ${packageMetadata.isApexFound}${EOL}`;




        SFPLogger.log(
          `-------------------------Installing Package------------------------------------${EOL}` +
            `Name: ${queue[i].package}${EOL}` +
            `Type: ${packageMetadata.package_type}${EOL}` +
            `Version Number: ${packageMetadata.package_version_number}${EOL}` +
            `Metadata Count: ${packageMetadata.metadataCount}${EOL}` +
            isApexFoundMessage +
            `-------------------------------------------------------------------------------${EOL}`,
          null,
          this.packageLogger,
          LoggerLevel.INFO
        );

        let packageInstallationResult = await this.installPackage(
          packageType,
          queue[i].package,
          this.targetusername,
          artifacts[0].sourceDirectoryPath,
          packageMetadata,
          queue[i].skipTesting,
          queue[i].aliasfy,
          this.wait_time
        );

        if (
          packageInstallationResult.result ===
          PackageInstallationStatus.Succeeded
        )
          deployed.push(queue[i].package);
        else if (
          packageInstallationResult.result === PackageInstallationStatus.Skipped
        ) {
          skipped.push(queue[i].package);
          continue;
        } else if (
          packageInstallationResult.result === PackageInstallationStatus.Failed
        ) {
          failed = queue.slice(i).map((pkg) => pkg.package);
          throw new Error(packageInstallationResult.message);
        } else
          throw new Error(
            `Unhandled PackageInstallationResult ${packageInstallationResult.result}`
          );

        if (this.isTestsToBeTriggered) {
          if (packageMetadata.isApexFound) {
            if (!queue[i].skipTesting) {
              let testResult = await this.triggerApexTests(
                queue[i].package,
                this.targetusername,
                queue[i].skipCoverageValidation,
                this.coverageThreshold
              );

              if (!testResult.result) {
                if (i !== queue.length - 1)
                  failed = queue.slice(i + 1).map((pkg) => pkg.package);
                throw new Error(testResult.message);
              } else SFPLogger.log(testResult.message, null, this.packageLogger, LoggerLevel.INFO);
            } else {
              SFPLogger.log(
                `Skipping testing of ${queue[i].package}\n`,
                null,
                this.packageLogger,
                LoggerLevel.INFO
              );
            }
          }
        }
      }

      if (this.logsGroupSymbol?.[1])
        SFPLogger.log(this.logsGroupSymbol[1], null, this.packageLogger, LoggerLevel.INFO);

      return {
        deployed: deployed,
        skipped: skipped,
        failed: failed,
      };
    } catch (err) {
      SFPLogger.log(err, null, this.packageLogger, LoggerLevel.INFO);

      return {
        deployed: deployed,
        skipped: skipped,
        failed: failed,
      };
    }
  }

  /**
   * Decider for which package installation type to run
   */
  private async installPackage(
    packageType: string,
    sfdx_package: string,
    targetUsername: string,
    sourceDirectoryPath: string,
    packageMetadata: PackageMetadata,
    skipTesting: boolean,
    aliasfy: boolean,
    wait_time: string
  ): Promise<PackageInstallationResult> {
    let packageInstallationResult: PackageInstallationResult;

    if (this.deploymentMode==DeploymentMode.NORMAL) {
      let skip_if_package_installed: boolean = true;

      if (packageType === "unlocked") {
        packageInstallationResult = await this.installUnlockedPackage(
          targetUsername,
          packageMetadata,
          skip_if_package_installed,
          wait_time,
          sourceDirectoryPath
        );
      } else if (packageType === "source") {
        let options = {
          optimizeDeployment: true,
          skipTesting: skipTesting,
        };

        packageInstallationResult = await this.installSourcePackage(
          sfdx_package,
          targetUsername,
          sourceDirectoryPath,
          packageMetadata,
          options,
          null,
          skip_if_package_installed,
          wait_time
        );
      } else if (packageType === "data") {
        packageInstallationResult = await this.installDataPackage(
          sfdx_package,
          targetUsername,
          sourceDirectoryPath,
          skip_if_package_installed,
          packageMetadata
        );
      } else {
        throw new Error(`Unhandled package type ${packageType}`);
      }
    } else if (this.deploymentMode == DeploymentMode.SOURCEPACKAGES) {

      if (packageType === "source" || packageType === "unlocked") {
        let options = {
          optimizeDeployment: false,
          skipTesting: true,
        };

        let subdirectory: string = aliasfy ? targetUsername : null;

        packageInstallationResult = await this.installSourcePackage(
          sfdx_package,
          targetUsername,
          sourceDirectoryPath,
          packageMetadata,
          options,
          subdirectory,
          this.skip_if_package_installed,
          wait_time
        );
      } else if (packageType === "data") {
        packageInstallationResult = await this.installDataPackage(
          sfdx_package,
          targetUsername,
          sourceDirectoryPath,
          this.skip_if_package_installed,
          packageMetadata
        );
      } else {
        throw new Error(`Unhandled package type ${packageType}`);
      }
    }
    return packageInstallationResult;
  }

  private installUnlockedPackage(
    targetUsername: string,
    packageMetadata: PackageMetadata,
    skip_if_package_installed: boolean,
    wait_time: string,
    sourceDirectoryPath: string
  ): Promise<PackageInstallationResult> {
    let options = {
      installationkey: null,
      apexcompile: "package",
      securitytype: "AdminsOnly",
      upgradetype: "Mixed",
    };

    let installUnlockedPackageImpl: InstallUnlockedPackageImpl = new InstallUnlockedPackageImpl(
      packageMetadata.package_version_id,
      targetUsername,
      options,
      wait_time,
      "10",
      skip_if_package_installed,
      packageMetadata,
      sourceDirectoryPath,
      this.packageLogger
    );

    return installUnlockedPackageImpl.exec();
  }

  private installSourcePackage(
    sfdx_package: string,
    targetUsername: string,
    sourceDirectoryPath: string,
    packageMetadata: PackageMetadata,
    options: any,
    subdirectory: string,
    skip_if_package_installed: boolean,
    wait_time: string
  ): Promise<PackageInstallationResult> {
    let installSourcePackageImpl: InstallSourcePackageImpl = new InstallSourcePackageImpl(
      sfdx_package,
      targetUsername,
      sourceDirectoryPath,
      subdirectory,
      options,
      wait_time,
      skip_if_package_installed,
      packageMetadata,
      false,
      this.packageLogger
    );

    return installSourcePackageImpl.exec();
  }

  private installDataPackage(
    sfdx_package: string,
    targetUsername: string,
    sourceDirectoryPath: string,
    skip_if_package_installed: boolean,
    packageMetadata: PackageMetadata
  ): Promise<PackageInstallationResult> {
    let installDataPackageImpl: InstallDataPackageImpl = new InstallDataPackageImpl(
      sfdx_package,
      targetUsername,
      sourceDirectoryPath,
      null,
      packageMetadata,
      skip_if_package_installed,
      false,
      this.packageLogger
    );
    return installDataPackageImpl.exec();
  }

  private triggerApexTests(
    sfdx_package: string,
    targetUsername: string,
    skipCoverageValidation: boolean,
    coverageThreshold: number
  ): Promise<{
    id: string;
    result: boolean;
    message: string;
  }> {
    let test_options = {
      wait_time: "60",
      testlevel: "RunAllTestsInPackage",
      package: sfdx_package,
      synchronous: false,
      validateIndividualClassCoverage: false,
      validatePackageCoverage: !skipCoverageValidation,
      coverageThreshold: coverageThreshold || 75,
      outputdir: ".testresults",
    };

    let triggerApexTestImpl: TriggerApexTestImpl = new TriggerApexTestImpl(
      targetUsername,
      test_options,
      null
    );

    return triggerApexTestImpl.exec();
  }

  /**
   * Checks if package should be installed to target username
   * @param packageDescriptor
   */
  private isSkipDeployment(
    packageDescriptor: any,
    targetUsername: string
  ): boolean {
    let skipDeployOnOrgs = packageDescriptor.skipDeployOnOrgs;
    if (skipDeployOnOrgs) {
      if (typeof skipDeployOnOrgs !== "string")
        throw new Error(
          `Expected comma-separated string for "skipDeployOnOrgs". Received ${JSON.stringify(
            packageDescriptor,
            null,
            4
          )}`
        );
      else
        return skipDeployOnOrgs
          .split(",")
          .map((org) => org.trim())
          .includes(targetUsername);
    } else return false;
  }


  /**
   * Verify that artifacts are on the same source version as HEAD
   */
  private async validateArtifacts(): Promise<void> {
    let git: SimpleGit = simplegit();

    let head: string = await git.revparse([`HEAD`]);

    let artifacts = ArtifactFilePathFetcher.fetchArtifactFilePaths(
      this.artifactDir
    );

    for (let artifact of artifacts) {
      let packageMetadata: PackageMetadata = JSON.parse(
        fs.readFileSync(artifact.packageMetadataFilePath, "utf8")
      );

      if (
        packageMetadata.sourceVersion != null &&
        packageMetadata.sourceVersion != head
      ) {
        throw new Error(
          `${packageMetadata.package_name} is on a different source version.` +
            `Artifacts must be on the same source version in order to determine the order of deployment.`
        );
      }
    }
  }

  /**
   * Returns the packages in the project config that have an artifact
   */
  private getPackagesToDeploy(): any[] {
    let packagesToDeploy: any[];

    let packages = ManifestHelpers.getSFDXPackageManifest(null)[
      "packageDirectories"
    ];
    let artifacts = ArtifactFilePathFetcher.findArtifacts(this.artifactDir);

    packagesToDeploy = packages.filter((pkg) => {
      let pattern = RegExp(`^${pkg.package}_sfpowerscripts_artifact.*`);
      return artifacts.find((artifact) =>
        pattern.test(path.basename(artifact))
      );
    });

    // Filter out packages that are to be skipped on the target org
    packagesToDeploy = packagesToDeploy.filter(
      (pkg) => !this.isSkipDeployment(pkg, this.targetusername)
    );

    //Ignore packages based on stage
    packagesToDeploy = packagesToDeploy.filter(
      (pkg) => {
        if (
          pkg.ignoreOnStage?.find( (stage) => {
            stage = stage.toLowerCase();
            return stage === Stage.DEPLOY || stage === Stage.VALIDATE || stage === Stage.PREPARE;
          })
        )
          return false;
        else
          return true;
      }
    );


    if (packagesToDeploy == null || packagesToDeploy.length === 0)
      throw new Error(`No artifacts from project config to be deployed`);
    else return packagesToDeploy;
  }
}
