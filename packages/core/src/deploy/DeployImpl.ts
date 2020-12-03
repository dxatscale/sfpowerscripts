import ArtifactFilePathFetcher from "../artifacts/ArtifactFilePathFetcher";
import simplegit, { SimpleGit } from "simple-git/promise";
import PackageMetadata from "../PackageMetadata";
import ManifestHelpers from "../manifest/ManifestHelpers";
import InstallSourcePackageImpl from "../sfdxwrappers/InstallSourcePackageImpl";
import InstallDataPackageImpl from "../sfdxwrappers/InstallDataPackageImpl";
import InstallUnlockedPackageImpl from "../sfdxwrappers/InstallUnlockedPackageImpl";
import TriggerApexTestImpl from "../sfdxwrappers/TriggerApexTestImpl";
import SFPStatsSender from "../utils/SFPStatsSender";
import fs = require("fs");
import {
  PackageInstallationResult,
  PackageInstallationStatus,
} from "../package/PackageInstallationResult";
import SFPLogger from "../utils/SFPLogger";
import { EOL } from "os";


export default class DeployImpl {


  constructor(
    private targetusername: string,
    private artifactDir: string,
    private wait_time: string,
    private logsGroupSymbol: string[],
    private tags: any,
    private isValidateMode: boolean,
    private coverageThreshold?: number
  ){}

  public async exec(): Promise<{deployed: string[], skipped: string[], failed: string[]}> {
    SFPLogger.isSupressLogs = true;
    let deployed: string[] = [];
    let skipped: string[] = [];
    let failed: string[] = [];

    try {
      let queue: any[] = this.getPackagesToDeploy();

      SFPStatsSender.logGauge(
        "deploy.scheduled",
        queue.length,
        this.tags
      );

      console.log(`Packages to be deployed:`, queue.map( (pkg) => pkg.package));

      await this.validateArtifacts();

      for (let i = 0 ; i < queue.length ; i++) {
        let artifacts = ArtifactFilePathFetcher.fetchArtifactFilePaths(
          this.artifactDir,
          queue[i].package
        );

        let packageMetadata: PackageMetadata = JSON.parse(
          fs.readFileSync(artifacts[0].packageMetadataFilePath, 'utf8')
        );

        let packageType: string = packageMetadata.package_type;

        if (this.logsGroupSymbol?.[0])
          console.log(this.logsGroupSymbol[0], "Installing", queue[i].package);

        let isApexFoundMessage: string =
          packageMetadata.package_type === "unlocked" ? "" : `Contains Apex Classes/Triggers: ${packageMetadata.isApexFound}${EOL}`

        console.log(
          `-------------------------Installing Package------------------------------------${EOL}` +
            `Name: ${queue[i].package}${EOL}` +
            `Type: ${packageMetadata.package_type}${EOL}` +
            `Version Number: ${packageMetadata.package_version_number}${EOL}` +
            `Metadata Count: ${packageMetadata.metadataCount}${EOL}` +
            isApexFoundMessage +
          `-------------------------------------------------------------------------------${EOL}`
        );


        let packageInstallationResult = await this.installPackage(
          packageType,
          this.isValidateMode,
          queue[i].package,
          this.targetusername,
          artifacts[0].sourceDirectoryPath,
          packageMetadata,
          this.isSkipTesting(queue[i]),
          queue[i].aliasfy,
          this.wait_time
        );

        if (packageInstallationResult.result === PackageInstallationStatus.Succeeded)
          deployed.push(queue[i].package);
        else if (packageInstallationResult.result === PackageInstallationStatus.Skipped)
          skipped.push(queue[i].package);
        else if (packageInstallationResult.result === PackageInstallationStatus.Failed) {
          failed = queue.slice(i).map( (pkg) => pkg.package);
          throw new Error(packageInstallationResult.message);
        }
        else
          throw new Error(`Unhandled PackageInstallationResult ${packageInstallationResult.result}`);


        if (!this.isSkipTesting(queue[i])) {
          if (
            this.isValidateMode &&
            (packageType === "unlocked" || packageType === "source")
          ) {
            await this.triggerApexTests(
              queue[i].package,
              this.targetusername,
              packageMetadata,
              queue[i].skipCoverageValidation,
              this.coverageThreshold
            );
          }
        } else
          console.log(`Skipping testing of ${queue[i].package}\n`);
      }

      if (this.logsGroupSymbol?.[1])
      console.log(this.logsGroupSymbol[1]);

      return {
        deployed: deployed,
        skipped: skipped,
        failed: failed
      };
    } catch (err) {
      console.log(err);

      return {
        deployed: deployed,
        skipped: skipped,
        failed: failed
      };
    }
  }

  /**
   * Decider for which package installation type to run
   */
  private async installPackage(
    packageType: string,
    isValidateMode: boolean,
    sfdx_package: string,
    targetUsername: string,
    sourceDirectoryPath: string,
    packageMetadata: PackageMetadata,
    skipTesting: boolean,
    aliasfy: boolean,
    wait_time: string
  ): Promise<PackageInstallationResult> {
    let packageInstallationResult: PackageInstallationResult;

    if (!isValidateMode) {
      if (packageType === "unlocked") {
        packageInstallationResult = await this.installUnlockedPackage(
          targetUsername,
          packageMetadata,
          wait_time
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
          wait_time
        );
      } else if (packageType === "data") {
        packageInstallationResult = await this.installDataPackage(
          sfdx_package,
          targetUsername,
          sourceDirectoryPath,
          packageMetadata
        );
      } else {
        throw new Error(`Unhandled package type ${packageType}`);
      }
    } else {
      if (packageType === "source" || packageType === "unlocked") {
        let options = {
          optimizeDeployment: false,
          skipTesting: true,
        };

        let subdirectory: string = aliasfy ? targetUsername : null;

        packageInstallationResult= await this.installSourcePackage(
          sfdx_package,
          targetUsername,
          sourceDirectoryPath,
          packageMetadata,
          options,
          subdirectory,
          wait_time
        );
      } else if ( packageType === "data") {
        packageInstallationResult = await this.installDataPackage(
          sfdx_package,
          targetUsername,
          sourceDirectoryPath,
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
    wait_time: string
  ): Promise<PackageInstallationResult> {
    let options = {
      installationkey: null,
      apexcompile: "package",
      securitytype: "AdminsOnly",
      upgradetype: "Mixed"
    };

    let installUnlockedPackageImpl: InstallUnlockedPackageImpl = new InstallUnlockedPackageImpl(
      packageMetadata.package_version_id,
      targetUsername,
      options,
      wait_time,
      "10",
      true,
      packageMetadata
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
    wait_time: string
  ): Promise<PackageInstallationResult> {

    let installSourcePackageImpl: InstallSourcePackageImpl = new InstallSourcePackageImpl(
      sfdx_package,
      targetUsername,
      sourceDirectoryPath,
      subdirectory,
      options,
      wait_time,
      true,
      packageMetadata,
      false
    );

    return installSourcePackageImpl.exec();
  }

  private installDataPackage(
    sfdx_package: string,
    targetUsername: string,
    sourceDirectoryPath: string,
    packageMetadata: PackageMetadata
  ): Promise<PackageInstallationResult> {
    let installDataPackageImpl: InstallDataPackageImpl = new InstallDataPackageImpl(
      sfdx_package,
      targetUsername,
      sourceDirectoryPath,
      null,
      packageMetadata,
      true,
      false
    );
    return installDataPackageImpl.exec();
  }

  private async triggerApexTests(
    sfdx_package: string,
    targetUsername: string,
    packageMetadata: PackageMetadata,
    skipCoverageValidation: boolean,
    coverageThreshold: number
  ) {
    if (packageMetadata.isApexFound) {
      let test_options = {
        wait_time: "60",
        testlevel: "RunAllTestsInPackage",
        package: sfdx_package,
        synchronous: false,
        validateIndividualClassCoverage: false,
        validatePackageCoverage: !skipCoverageValidation,
        coverageThreshold: coverageThreshold || 75,
        outputdir: ".testresults"
      };

      let triggerApexTestImpl: TriggerApexTestImpl = new TriggerApexTestImpl(
        targetUsername,
        test_options,
        null
      );

      let testResult = await triggerApexTestImpl.exec();
      if (!testResult.result)
        throw new Error(testResult.message);
      else
        console.log(testResult.message);
    }
  }

  /**
   * Checks if package should be installed to target username
   * @param packageDescriptor
   */
  private isSkipDeployment(packageDescriptor: any, targetUsername: string): boolean {
    let skipDeployOnOrgs = packageDescriptor.skipDeployOnOrgs;
    if (skipDeployOnOrgs) {
      if (typeof(skipDeployOnOrgs) !== "string")
        throw new Error(`Expected comma-separated string for "skipDeployOnOrgs". Received ${JSON.stringify(packageDescriptor,null,4)}`);
      else
        return (
          skipDeployOnOrgs
            .split(",")
            .map((org) => org.trim())
            .includes(targetUsername)
        );
    } else
      return false;
  }

  private isSkipTesting(packageDescriptor: any): boolean {
    return packageDescriptor.skipTesting ? true : false;
  }

  /**
   * Verify that artifacts are on the same source version as HEAD
   */
  private async validateArtifacts(): Promise<void> {
    let git: SimpleGit = simplegit();

    let head: string = await git.revparse([`HEAD`]);

    let artifacts = ArtifactFilePathFetcher.fetchArtifactFilePaths(this.artifactDir);

    for (let artifact of artifacts) {
      let packageMetadata: PackageMetadata = JSON.parse(
        fs.readFileSync(artifact.packageMetadataFilePath, "utf8")
      );

      if (
        packageMetadata.sourceVersion != null &&
        packageMetadata.sourceVersion != head
      ) {
        throw new Error(`${packageMetadata.package_name} is on a different source version.` +
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

    let packages = ManifestHelpers.getSFDXPackageManifest(null)["packageDirectories"];
    let artifacts = ArtifactFilePathFetcher.findArtifacts(this.artifactDir);

    packagesToDeploy =  packages.filter( (pkg) => {
      let pattern = RegExp(`^${pkg.package}_sfpowerscripts_artifact.*`);
      return artifacts.find((artifact) => pattern.test(artifact));
    });

    // Filter out packages that are to be skipped on the target org
    packagesToDeploy = packages.filter( (pkg) => !this.isSkipDeployment(pkg, this.targetusername));

    if (packagesToDeploy == null || packagesToDeploy.length === 0)
      throw new Error(`No artifacts from project config to be deployed`);
    else
      return packagesToDeploy
  }
}
