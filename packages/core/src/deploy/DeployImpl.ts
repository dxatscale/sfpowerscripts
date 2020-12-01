import ArtifactFilePathFetcher from "../artifacts/ArtifactFilePathFetcher";
import simplegit, { SimpleGit } from "simple-git/promise";
import PackageMetadata from "../PackageMetadata";
import ManifestHelpers from "../manifest/ManifestHelpers";
import InstallSourcePackageImpl from "../sfdxwrappers/InstallSourcePackageImpl";
import InstallDataPackageImpl from "../sfdxwrappers/InstallDataPackageImpl";
import InstallUnlockedPackageImpl from "../sfdxwrappers/InstallUnlockedPackageImpl";
import TriggerApexTestImpl from "../sfdxwrappers/TriggerApexTestImpl";
import child_process = require("child_process");
import path = require("path");
import fs = require("fs");
import {
  PackageInstallationResult,
  PackageInstallationStatus,
} from "../package/PackageInstallationResult";
import SFPLogger from "../utils/SFPLogger";

export default class DeployImpl {

 constructor(
  private targetusername: string,
  private projectDirectory: string,
  private artifactDir: string,
  private wait_time: string,
  private validateClassCoverageFor: string[],
  private isValidateMode: boolean
 ){}

  public async exec(): Promise<void> {
    SFPLogger.isSupressLogs = true;

    await this.validateArtifacts();


    let project_config = ManifestHelpers.getSFDXPackageManifest(this.projectDirectory);

    for (let pkg of project_config["packageDirectories"]) {
      let artifacts = ArtifactFilePathFetcher.fetchArtifactFilePaths(
        this.artifactDir,
        pkg.package
      );

      if (artifacts.length === 0)
        throw new Error(`Artifact not found for ${pkg.package}`);

      let packageMetadata: PackageMetadata = JSON.parse(
        fs.readFileSync(artifacts[0].packageMetadataFilePath, 'utf8')
      );

      let packageType: string = ManifestHelpers.getPackageType(
        project_config,
        pkg.package
      );

      await this.installPackage(
        packageType,
        this.isValidateMode,
        pkg.package,
        this.targetusername,
        artifacts[0].sourceDirectoryPath,
        packageMetadata,
        this.wait_time
      );

      if (
        this.isValidateMode &&
        (packageType === "Unlocked" || packageType === "Source")
      )
        await this.triggerApexTests(
          pkg.package,
          this.targetusername,
          packageMetadata
        );
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
    wait_time: string
  ): Promise<void> {
    if (!isValidateMode) {
      if (packageType === "Unlocked") {
        await this.installUnlockedPackage(
          targetUsername,
          packageMetadata,
          wait_time
        );
      } else if (packageType === "Source") {
        await this.installSourcePackage(
          sfdx_package,
          targetUsername,
          sourceDirectoryPath,
          packageMetadata,
          wait_time
        );
      } else if (packageType === "Data") {
        await this.installDataPackage(
          sfdx_package,
          targetUsername,
          sourceDirectoryPath,
          packageMetadata
        );
      } else {
        throw new Error(`Unhandled package type ${packageType}`);
      }
    } else {
      if (packageType === "Source" || packageType === "Unlocked") {
        await this.installSourcePackage(
          sfdx_package,
          targetUsername,
          sourceDirectoryPath,
          packageMetadata,
          wait_time
        );
      } else if ( packageType === "Data") {
        await this.installDataPackage(
          sfdx_package,
          targetUsername,
          sourceDirectoryPath,
          packageMetadata
        );
      }
    }
  }

  private async installUnlockedPackage(
    targetUsername: string,
    packageMetadata: PackageMetadata,
    wait_time: string
  ) {
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

    await installUnlockedPackageImpl.exec();
  }

  private async installSourcePackage(
    sfdx_package: string,
    targetUsername: string,
    sourceDirectoryPath: string,
    packageMetadata: PackageMetadata,
    wait_time: string
  ) {
    let options = {
      optimizeDeployment: false,
      skipTesting: true,
    };

    let installSourcePackageImpl: InstallSourcePackageImpl = new InstallSourcePackageImpl(
      sfdx_package,
      targetUsername,
      sourceDirectoryPath,
      null,
      options,
      wait_time,
      true,
      packageMetadata,
      false
    );

    let installResult = await installSourcePackageImpl.exec();

    if (installResult.result === PackageInstallationStatus.Failed)
      throw new Error(installResult.message);
  }

  private async installDataPackage(
    sfdx_package: string,
    targetUsername: string,
    sourceDirectoryPath: string,
    packageMetadata: PackageMetadata
  ) {
    let installDataPackageImpl: InstallDataPackageImpl = new InstallDataPackageImpl(
      sfdx_package,
      targetUsername,
      sourceDirectoryPath,
      null,
      packageMetadata,
      true,
      false
    );
    let installResult = await installDataPackageImpl.exec();

    if (installResult.result === PackageInstallationStatus.Failed)
      throw new Error(installResult.message);
  }

  private async triggerApexTests(
    sfdx_package: string,
    targetUsername: string,
    packageMetadata: PackageMetadata
  ) {
    if (packageMetadata.apexTestClassses) {
      let test_options = {
        wait_time: "60",
        testlevel: "RunAllTestsInPackage",
        package: sfdx_package,
        synchronous: false,
        validateIndividualClassCoverage: false,
        validatePackageCoverage: true,
        coverageThreshold: 75,
        outputdir: ".testresults"
      };

      let triggerApexTestImpl: TriggerApexTestImpl = new TriggerApexTestImpl(
        targetUsername,
        test_options,
        process.cwd()
      );

      let testResult = await triggerApexTestImpl.exec();
      if (!testResult.result)
        throw new Error(testResult.message);
      else
        console.log(testResult.message);
    }
  }

  /**
   * Verify that artifacts are on the same source version as HEAD
   */
  private async validateArtifacts(): Promise<void> {
    let git: SimpleGit;
    if (this.projectDirectory) {
      git = simplegit(this.projectDirectory);
    } else {
      git = simplegit();
    }

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


}
