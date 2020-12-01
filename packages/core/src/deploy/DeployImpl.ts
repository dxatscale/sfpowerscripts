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

    // TODO: Add support for non-validate mode
    if (this.isValidateMode) {
      for (let pkg of project_config["packageDirectories"]) {
        let artifacts = ArtifactFilePathFetcher.fetchArtifactFilePaths(this.artifactDir, pkg.package);

        if (artifacts.length === 0)
          throw new Error(`Artifact not found for ${pkg.package}`);

        let packageMetadata: PackageMetadata = JSON.parse(
          fs.readFileSync(artifacts[0].packageMetadataFilePath, 'utf8')
        );

        let packageType: string = ManifestHelpers.getPackageType(
          project_config,
          pkg.package
        );

        if (packageType === "Source" || packageType === "Unlocked") {
          let options = {
            optimizeDeployment: false,
            skipTesting: true,
          };

          let installSourcePackageImpl: InstallSourcePackageImpl = new InstallSourcePackageImpl(
            pkg.package,
            this.targetusername,
            artifacts[0].sourceDirectoryPath,
            null,
            options,
            this.wait_time,
            true,
            packageMetadata,
            false
          );

          let installResult = await installSourcePackageImpl.exec();

          if (installResult.result === PackageInstallationStatus.Failed)
            throw new Error(installResult.message);

          if (packageMetadata.apexTestClassses) {
            let test_options = {
              wait_time: "60",
              testlevel: "RunAllTestsInPackage",
              package: pkg.package,
              synchronous: false,
              validateIndividualClassCoverage: false,
              validatePackageCoverage: true,
              coverageThreshold: 75,
              outputdir: ".testresults"
            };

            let triggerApexTestImpl: TriggerApexTestImpl = new TriggerApexTestImpl(
              this.targetusername,
              test_options,
              this.projectDirectory
            );

            let testResult = await triggerApexTestImpl.exec();
            if (!testResult.result)
              throw new Error(testResult.message);
            else
              console.log(testResult.message);
          }
        } else if (packageType === "Data") {
          let installDataPackageImpl: InstallDataPackageImpl = new InstallDataPackageImpl(
            pkg.package,
            this.targetusername,
            artifacts[0].sourceDirectoryPath,
            null,
            packageMetadata,
            true,
            false
          );
          let installResult = await installDataPackageImpl.exec();

          if (installResult.result === PackageInstallationStatus.Failed)
            throw new Error(installResult.message);
        } else {
          throw new Error(`Unhandled package type ${packageType}`);
        }
      }
    } else {
      for (let pkg of project_config["packageDirectories"]) {
        let artifacts = ArtifactFilePathFetcher.fetchArtifactFilePaths(this.artifactDir, pkg.package);

        if (artifacts.length === 0)
          throw new Error(`Artifact not found for ${pkg.package}`);

        let packageMetadata: PackageMetadata = JSON.parse(
          fs.readFileSync(artifacts[0].packageMetadataFilePath, 'utf8')
        );

        let packageType: string = ManifestHelpers.getPackageType(project_config, pkg.package);

        if (packageType === "Unlocked") {
          let options = {
            installationkey: null,
            apexcompile: "package",
            securitytype: "AdminsOnly",
            upgradetype: "Mixed"
          };

          let installUnlockedPackageImpl: InstallUnlockedPackageImpl = new InstallUnlockedPackageImpl(
            packageMetadata.package_version_id,
            this.targetusername,
            options,
            this.wait_time,
            "10",
            true,
            packageMetadata
          );

          await installUnlockedPackageImpl.exec();
        } else if (packageType === "Source") {
          let options = {
            optimizeDeployment: false,
            skipTesting: true,
          };

          let installSourcePackageImpl: InstallSourcePackageImpl = new InstallSourcePackageImpl(
            pkg.package,
            this.targetusername,
            artifacts[0].sourceDirectoryPath,
            null,
            options,
            this.wait_time,
            true,
            packageMetadata,
            false
          );

          let installResult = await installSourcePackageImpl.exec();

          if (installResult.result === PackageInstallationStatus.Failed)
            throw new Error(installResult.message);
        } else if (packageType === "Data") {
          let installDataPackageImpl: InstallDataPackageImpl = new InstallDataPackageImpl(
            pkg.package,
            this.targetusername,
            artifacts[0].sourceDirectoryPath,
            null,
            packageMetadata,
            true,
            false
          );
          let installResult = await installDataPackageImpl.exec();

          if (installResult.result === PackageInstallationStatus.Failed)
            throw new Error(installResult.message);
        } else {
          throw new Error(`Unhandled package type ${packageType}`);
        }
      }
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
