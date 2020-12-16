import ArtifactFilePathFetcher from "@dxatscale/sfpowerscripts.core/lib/artifacts/ArtifactFilePathFetcher";
import simplegit, { SimpleGit } from "simple-git/promise";
import PackageMetadata from "@dxatscale/sfpowerscripts.core/lib/PackageMetadata";
import ManifestHelpers from "@dxatscale/sfpowerscripts.core/lib/manifest/ManifestHelpers";
import InstallSourcePackageImpl from "@dxatscale/sfpowerscripts.core/lib/sfdxwrappers/InstallSourcePackageImpl";
import InstallDataPackageImpl from "@dxatscale/sfpowerscripts.core/lib/sfdxwrappers/InstallDataPackageImpl";
import InstallUnlockedPackageImpl from "@dxatscale/sfpowerscripts.core/lib/sfdxwrappers/InstallUnlockedPackageImpl";
import TriggerApexTestImpl from "@dxatscale/sfpowerscripts.core/lib/sfdxwrappers/TriggerApexTestImpl";
import SFPStatsSender from "@dxatscale/sfpowerscripts.core/lib/utils/SFPStatsSender";
import fs = require("fs");
import path = require("path");
import {
  PackageInstallationResult,
  PackageInstallationStatus,
} from "@dxatscale/sfpowerscripts.core/lib/package/PackageInstallationResult";
import SFPLogger, { LoggerLevel } from "@dxatscale/sfpowerscripts.core/lib/utils/SFPLogger";
import { EOL } from "os";
import { Stage } from "../Stage";


export enum DeploymentMode {
  NORMAL,
  SOURCEPACKAGES,
}

export interface DeployProps
{
  targetUsername:string,
  artifactDir:string
  deploymentMode:DeploymentMode,
  isTestsToBeTriggered:boolean,
  skipIfPackageInstalled:boolean
  isValidateArtifactsOnHead?:boolean
  logsGroupSymbol?:string[],
  coverageThreshold?:number
  waitTime:number,
  tags?:any,
  packageLogger?:any
  currentStage?: Stage,

}

export default class DeployImpl {



  constructor(
    private props:DeployProps
  ) {}



  public async exec(): Promise<{
    deployed: string[];
    skipped: string[];
    failed: string[];
    testFailure: string
  }> {
    let deployed: string[] = [];
    let skipped: string[] = [];
    let failed: string[] = [];

    let testFailure: string;
    try {
      let queue: any[] = this.getPackagesToDeploy();

      SFPStatsSender.logGauge("deploy.scheduled", queue.length, this.props.tags);

      SFPLogger.log(
        `Packages to be deployed:`,
        queue.map((pkg) => pkg.package),
        this.props.packageLogger,
        LoggerLevel.INFO
      );

      if (this.props.isValidateArtifactsOnHead)
        await this.validateArtifacts();

      for (let i = 0; i < queue.length; i++) {



        let artifacts = ArtifactFilePathFetcher.fetchArtifactFilePaths(
          this.props.artifactDir,
          queue[i].package
        );

        let packageMetadata: PackageMetadata = JSON.parse(
          fs.readFileSync(artifacts[0].packageMetadataFilePath, "utf8")
        );

        let packageType: string = packageMetadata.package_type;

        if (this.props.logsGroupSymbol?.[0])
          SFPLogger.log(
            this.props.logsGroupSymbol[0],
            `Installing ${queue[i].package}`,
            this.props.packageLogger,
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
          this.props.packageLogger,
          LoggerLevel.INFO
        );

        let packageInstallationResult = await this.installPackage(
          packageType,
          queue[i].package,
          this.props.targetUsername,
          artifacts[0].sourceDirectoryPath,
          packageMetadata,
          queue[i].skipTesting,
          this.props.waitTime.toString()
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

        if (this.props.isTestsToBeTriggered) {
          if (packageMetadata.isApexFound) {
            if (!queue[i].skipTesting) {
              let testResult = await this.triggerApexTests(
                queue[i].package,
                this.props.targetUsername,
                queue[i].skipCoverageValidation,
                this.props.coverageThreshold
              );

              if (!testResult.result) {
                testFailure = queue[i].package;

                if (i !== queue.length - 1)
                  failed = queue.slice(i + 1).map((pkg) => pkg.package);

                throw new Error(testResult.message);
              } else SFPLogger.log(testResult.message, null, this.props.packageLogger, LoggerLevel.INFO);
            } else {
              SFPLogger.log(
                `Skipping testing of ${queue[i].package}\n`,
                null,
                this.props.packageLogger,
                LoggerLevel.INFO
              );
            }
          }
        }
      }

      if (this.props.logsGroupSymbol?.[1])
        SFPLogger.log(this.props.logsGroupSymbol[1], null, this.props.packageLogger, LoggerLevel.INFO);

      return {
        deployed: deployed,
        skipped: skipped,
        failed: failed,
        testFailure: testFailure
      };
    } catch (err) {
      SFPLogger.log(err, null, this.props.packageLogger, LoggerLevel.INFO);

      return {
        deployed: deployed,
        skipped: skipped,
        failed: failed,
        testFailure: testFailure
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
    wait_time: string
  ): Promise<PackageInstallationResult> {
    let packageInstallationResult: PackageInstallationResult;

    if (this.props.deploymentMode==DeploymentMode.NORMAL) {

      if (packageType === "unlocked") {
        packageInstallationResult = await this.installUnlockedPackage(
          targetUsername,
          packageMetadata,
          this.props.skipIfPackageInstalled,
          wait_time,
          sourceDirectoryPath
        );
      } else if (packageType === "source") {

        let options = {
          optimizeDeployment: this.isOptimizedDeploymentForSourcePackages(sfdx_package),
          skipTesting: skipTesting,
        };

        packageInstallationResult = await this.installSourcePackage(
          sfdx_package,
          targetUsername,
          sourceDirectoryPath,
          packageMetadata,
          options,
          this.props.skipIfPackageInstalled,
          wait_time
        );
      } else if (packageType === "data") {
        packageInstallationResult = await this.installDataPackage(
          sfdx_package,
          targetUsername,
          sourceDirectoryPath,
          this.props.skipIfPackageInstalled,
          packageMetadata
        );
      } else {
        throw new Error(`Unhandled package type ${packageType}`);
      }
    } else if (this.props.deploymentMode == DeploymentMode.SOURCEPACKAGES) {

      if (packageType === "source" || packageType === "unlocked") {
        let options = {
          optimizeDeployment: false,
          skipTesting: true,
        };

        packageInstallationResult = await this.installSourcePackage(
          sfdx_package,
          targetUsername,
          sourceDirectoryPath,
          packageMetadata,
          options,
          this.props.skipIfPackageInstalled,
          wait_time
        );
      } else if (packageType === "data") {
        packageInstallationResult = await this.installDataPackage(
          sfdx_package,
          targetUsername,
          sourceDirectoryPath,
          this.props.skipIfPackageInstalled,
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
      this.props.packageLogger
    );

    return installUnlockedPackageImpl.exec();
  }

  private installSourcePackage(
    sfdx_package: string,
    targetUsername: string,
    sourceDirectoryPath: string,
    packageMetadata: PackageMetadata,
    options: any,
    skip_if_package_installed: boolean,
    wait_time: string
  ): Promise<PackageInstallationResult> {
    let installSourcePackageImpl: InstallSourcePackageImpl = new InstallSourcePackageImpl(
      sfdx_package,
      targetUsername,
      sourceDirectoryPath,
      options,
      wait_time,
      skip_if_package_installed,
      packageMetadata,
      false,
      this.props.packageLogger,
      path.join(sourceDirectoryPath, "forceignores", "." + this.props.currentStage + "ignore")
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
      packageMetadata,
      skip_if_package_installed,
      false,
      this.props.packageLogger
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


  //Allow individual packages to use non optimized path
  private isOptimizedDeploymentForSourcePackages(
    sfdx_package:string
  ): boolean {
    let pkgDescriptor = ManifestHelpers.getSFDXPackageDescriptor(null, sfdx_package);

    if(pkgDescriptor["isOptimizedDeployment"] == null)
      return true;
    else
      return pkgDescriptor["isOptimizedDeployment"];
  }


  /**
   * Verify that artifacts are on the same source version as HEAD
   */
  private async validateArtifacts(): Promise<void> {
    let git: SimpleGit = simplegit();

    let head: string = await git.revparse([`HEAD`]);

    let artifacts = ArtifactFilePathFetcher.fetchArtifactFilePaths(
      this.props.artifactDir
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
    let artifacts = ArtifactFilePathFetcher.findArtifacts(this.props.artifactDir);

    packagesToDeploy = packages.filter((pkg) => {
      let pattern = RegExp(`^${pkg.package}_sfpowerscripts_artifact.*`);
      return artifacts.find((artifact) =>
        pattern.test(path.basename(artifact))
      );
    });

    // Filter out packages that are to be skipped on the target org
    packagesToDeploy = packagesToDeploy.filter(
      (pkg) => !this.isSkipDeployment(pkg, this.props.targetUsername)
    );




    //Ignore packages based on stage
    packagesToDeploy = packagesToDeploy.filter(
      (pkg) => {
        if (
          pkg.ignoreOnStage?.find( (stage) => {
            stage = stage.toLowerCase();
            return stage === this.props.currentStage;
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
