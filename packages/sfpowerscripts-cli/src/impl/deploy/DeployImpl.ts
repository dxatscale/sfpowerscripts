import ArtifactFilePathFetcher, {ArtifactFilePaths} from "@dxatscale/sfpowerscripts.core/lib/artifacts/ArtifactFilePathFetcher";
import PackageMetadata from "@dxatscale/sfpowerscripts.core/lib/PackageMetadata";
import SFPStatsSender from "@dxatscale/sfpowerscripts.core/lib/utils/SFPStatsSender";
import InstallUnlockedPackageImpl from "@dxatscale/sfpowerscripts.core/lib/sfpcommands/package/InstallUnlockedPackageImpl";
import InstallSourcePackageImpl from "@dxatscale/sfpowerscripts.core/lib/sfpcommands/package/InstallSourcePackageImpl";
import InstallDataPackageImpl from "@dxatscale/sfpowerscripts.core/lib/sfpcommands/package/InstallDataPackageImpl";

import fs = require("fs");
import path = require("path");
import {
  PackageInstallationResult,
  PackageInstallationStatus,
} from "@dxatscale/sfpowerscripts.core/lib/package/PackageInstallationResult";
import SFPLogger, { LoggerLevel } from "@dxatscale/sfpowerscripts.core/lib/utils/SFPLogger";
import { EOL } from "os";
import { Stage } from "../Stage";
import ProjectConfig from "@dxatscale/sfpowerscripts.core/lib/project/ProjectConfig";
import TriggerApexTests from "@dxatscale/sfpowerscripts.core/lib/sfpcommands/apextest/TriggerApexTests";
import SFPPackage from "@dxatscale/sfpowerscripts.core/lib/package/SFPPackage";
import { CoverageOptions } from "@dxatscale/sfpowerscripts.core/lib/package/IndividualClassCoverage";
import { RunAllTestsInPackageOptions } from "@dxatscale/sfpowerscripts.core/lib/sfpcommands/apextest/ExtendedTestOptions";
import { TestOptions } from "@dxatscale/sfpowerscripts.core/lib/sfdxwrappers/TestOptions";



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
  skipIfPackageInstalled:boolean,
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
    testFailure: string;
    error: any;
  }> {
    let deployed: string[] = [];
    let skipped: string[] = [];
    let failed: string[] = [];

    let testFailure: string;
    try {

      let artifacts = ArtifactFilePathFetcher.fetchArtifactFilePaths(
        this.props.artifactDir
      );

      if (artifacts.length === 0)
      throw new Error(`No artifacts to deploy found in ${this.props.artifactDir}`);

      this.validateArtifactsSourceRepository(artifacts);
      let packageManifest = this.getLatestPackageManifest(artifacts);

      if (packageManifest === null) {
        // If unable to find latest package manfest in artifacts, use package manifest in project directory
        packageManifest = ProjectConfig.getSFDXPackageManifest(null);
      }

      let queue: any[] = this.getPackagesToDeploy(packageManifest);

      let packagesToPackageInfo = this.getPackagesToPackageInfo(artifacts);
      SFPStatsSender.logGauge("deploy.scheduled", queue.length, this.props.tags);

      SFPLogger.log(
        `Packages to be deployed:`,
        queue.map((pkg) => pkg.package),
        this.props.packageLogger,
        LoggerLevel.INFO
      );


      for (let i = 0; i < queue.length; i++) {
        let packageInfo = packagesToPackageInfo[queue[i].package];
        let packageMetadata: PackageMetadata = packageInfo.packageMetadata;

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
          packageInfo.sourceDirectory,
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
        testFailure: testFailure,
        error: null
      };
    } catch (err) {
      SFPLogger.log(err, null, this.props.packageLogger, LoggerLevel.INFO);

      return {
        deployed: deployed,
        skipped: skipped,
        failed: failed,
        testFailure: testFailure,
        error: err
      };
    }
  }

  /**
   * Returns map of package name to package info
   * @param artifacts
   */
  private getPackagesToPackageInfo(
    artifacts: ArtifactFilePaths[]
  ): {[p: string]: PackageInfo} {
    let packagesToPackageInfo: {[p: string]: PackageInfo} = {};
    for (let artifact of artifacts) {
      let packageMetadata: PackageMetadata = JSON.parse(
        fs.readFileSync(artifact.packageMetadataFilePath, "utf8")
      );
      packagesToPackageInfo[packageMetadata.package_name] = {
        sourceDirectory: artifact.sourceDirectoryPath,
        packageMetadata: packageMetadata
      }
    }
    return packagesToPackageInfo;
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
      this.props.currentStage == "prepare" ? path.join(sourceDirectoryPath, "forceignores", ".prepareignore") : null
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

  private  async triggerApexTests(
    sfdx_package: string,
    targetUsername: string,
    skipCoverageValidation: boolean,
    coverageThreshold: number
  ): Promise<{
    id: string;
    result: boolean;
    message: string;
  }> {

    let sfPackage:SFPPackage = await SFPPackage.buildPackageFromProjectConfig(null,sfdx_package,null,this.props.packageLogger);
    let testOptions:TestOptions = new RunAllTestsInPackageOptions(sfPackage,60,".testresults");
    let testCoverageOptions:CoverageOptions ={
      isIndividualClassCoverageToBeValidated:false,
      isPackageCoverageToBeValidated:!skipCoverageValidation,
      coverageThreshold:coverageThreshold || 75
    }



    let triggerApexTests: TriggerApexTests = new TriggerApexTests(
      targetUsername,
      testOptions,
      testCoverageOptions,
      null
    );

    return triggerApexTests.exec();
  }

  /**
   * Checks if package should be installed to target username
   * @param packageDescriptor
   */
  private isSkipDeployment(
    packageDescriptor: any,
    targetUsername: string
  ): boolean {
    let skipDeployOnOrgs: string[] = packageDescriptor.skipDeployOnOrgs;
    if (skipDeployOnOrgs) {
      if (!(skipDeployOnOrgs instanceof Array))
        throw new Error(`Property 'skipDeployOnOrgs' must be of type Array`);
      else
        return skipDeployOnOrgs.includes(targetUsername);
    } else return false;
  }


  //Allow individual packages to use non optimized path
  private isOptimizedDeploymentForSourcePackages(
    sfdx_package:string
  ): boolean {
    let pkgDescriptor = ProjectConfig.getSFDXPackageDescriptor(null, sfdx_package);

    if(pkgDescriptor["isOptimizedDeployment"] == null)
      return true;
    else
      return pkgDescriptor["isOptimizedDeployment"];
  }


  /**
   * Verify that artifacts are from the same source repository
   */
  private validateArtifactsSourceRepository(artifacts: ArtifactFilePaths[]): void {
    let sourceRepository: string;
    for (let artifact of artifacts) {
      let packageMetadata: PackageMetadata = JSON.parse(
        fs.readFileSync(artifact.packageMetadataFilePath, "utf8")
      );

      if (sourceRepository == null)
        sourceRepository = packageMetadata.repository_url;

      if (sourceRepository !== packageMetadata.repository_url)
        throw new Error("Artifacts must originate from the same source repository, for deployment to work");
    }
  }

  /**
   * Gets latest package manifest from artifacts
   * Returns null if unable to find latest package manifest
   * @param artifacts
   */
  private getLatestPackageManifest(artifacts: ArtifactFilePaths[]): any {
    let latestPackageManifest: any;

    let latestPackageMetadata: PackageMetadata;
    for (let artifact of artifacts) {
      let packageMetadata: PackageMetadata = JSON.parse(
        fs.readFileSync(artifact.packageMetadataFilePath, "utf8")
      );

      if (
        latestPackageMetadata == null ||
        latestPackageMetadata.creation_details.timestamp < packageMetadata.creation_details.timestamp
      ) {
        latestPackageMetadata = packageMetadata;

        let pathToPackageManifest = path.join(artifact.sourceDirectoryPath, "manifests", "sfdx-project.json.ori");
        if (fs.existsSync(pathToPackageManifest)) {
          latestPackageManifest = JSON.parse(fs.readFileSync(pathToPackageManifest, "utf8"));
        }
      }
    }

    if (latestPackageManifest) {
      SFPLogger.log(
        `Found latest package manifest in ${latestPackageMetadata.package_name} artifact`,
         null,
         this.props.packageLogger,
         LoggerLevel.INFO
      );
      return latestPackageManifest;
    } else return null
  }

  /**
   * Returns the packages in the project config that have an artifact
   */
  private getPackagesToDeploy(packageManifest: any): any[] {
    let packagesToDeploy: any[];

    let packages = packageManifest["packageDirectories"];

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

interface PackageInfo {
  sourceDirectory: string,
  packageMetadata: PackageMetadata
}
