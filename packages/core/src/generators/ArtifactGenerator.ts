import path = require("path");
import * as fs from "fs-extra";
import PackageMetadata from "../PackageMetadata";
import GeneratePackageChangelog from "../changelog/GeneratePackageChangelog";
import { Changelog } from "../changelog/interfaces/GenericChangelogInterfaces";
import * as rimraf from "rimraf";
import SFPLogger, { LoggerLevel } from "../logger/SFPLogger";
import AdmZip = require("adm-zip");

export default class ArtifactGenerator {
  //Generates the universal artifact used by the CLI and AZP
  public static async generateArtifact(
    sfdx_package: string,
    project_directory: string,
    artifact_directory: string,
    packageArtifactMetadata: PackageMetadata
  ): Promise<string> {
    try {
      // Artifact folder consisting of artifact metadata, changelog & source
      let artifactFolder: string =
        sfdx_package == null
          ? "sfpowerscripts_artifact"
          : `${sfdx_package}_sfpowerscripts_artifact`;

      // Absolute filepath of artifact
      let artifactFilepath: string;

      if (artifact_directory != null) {
        artifactFilepath = path.resolve(artifact_directory, artifactFolder);
      } else {
        artifactFilepath = path.resolve(artifactFolder);
      }

      fs.mkdirpSync(artifactFilepath);

      let sourcePackage: string = path.join(artifactFilepath, `source`);
      fs.mkdirpSync(sourcePackage);
      fs.copySync(packageArtifactMetadata.sourceDir, sourcePackage);

      rimraf.sync(packageArtifactMetadata.sourceDir);

      //Modify Source Directory to the new source directory inside the artifact
      packageArtifactMetadata.sourceDir = `source`;

      let artifactMetadataFilePath: string = path.join(
        artifactFilepath,
        `artifact_metadata.json`
      );

      fs.writeFileSync(
        artifactMetadataFilePath,
        JSON.stringify(packageArtifactMetadata, null, 4)
      );

      // Generate package changelog
      let generatePackageChangelog: GeneratePackageChangelog = new GeneratePackageChangelog(
        sfdx_package,
        packageArtifactMetadata.sourceVersionFrom,
        packageArtifactMetadata.sourceVersionTo
          ? packageArtifactMetadata.sourceVersionTo
          : packageArtifactMetadata.sourceVersion,
        project_directory
      );

      let packageChangelog: Changelog = await generatePackageChangelog.exec();

      let changelogFilepath: string = path.join(
        artifactFilepath,
        `changelog.json`
      );

      fs.writeFileSync(
        changelogFilepath,
        JSON.stringify(packageChangelog, null, 4)
      );

      SFPLogger.log("Artifact Copy Completed",LoggerLevel.DEBUG);

      let zip = new AdmZip();
      zip.addLocalFolder(artifactFilepath, artifactFolder);
      SFPLogger.log(`Zipping ${artifactFolder}`,LoggerLevel.DEBUG);

      let packageVersionNumber: string = ArtifactGenerator.substituteBuildNumberWithPreRelease(
        packageArtifactMetadata.package_version_number
      );

      let zipArtifactFilepath: string =
        artifactFilepath + `_` + packageVersionNumber + `.zip`;
      zip.writeZip(zipArtifactFilepath);

      SFPLogger.log(`Artifact Generation Completed for ${sfdx_package} to ${zipArtifactFilepath}`,LoggerLevel.INFO);

      // Cleanup unzipped artifact
      rimraf.sync(artifactFilepath);

      return zipArtifactFilepath;
    } catch (error) {
      throw new Error("Unable to create artifact" + error);
    }
  }

  private static substituteBuildNumberWithPreRelease(
    packageVersionNumber: string
  ) {
    let segments = packageVersionNumber.split(".");

    if (segments.length === 4) {
      packageVersionNumber = segments.reduce(
        (version, segment, segmentsIdx) => {
          if (segmentsIdx === 3) return version + "-" + segment;
          else return version + "." + segment;
        }
      );
    }

    return packageVersionNumber;
  }
}
