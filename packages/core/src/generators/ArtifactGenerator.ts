import path = require("path");
import fs = require("fs-extra");
import PackageMetadata from "../PackageMetadata";
import GeneratePackageChangelog from "../changelog/GeneratePackageChangelog";
import { Changelog } from "../changelog/interfaces/GenericChangelogInterfaces";
import { isNullOrUndefined } from "util";
import * as rimraf from "rimraf";
import Logger from "../utils/Logger";

export default class ArtifactGenerator {


  //Generates the universal artifact used by the CLI and AZP
  public static async generateArtifact(
    sfdx_package: string,
    project_directory: string,
    artifact_directory: string,
    packageArtifactMetadata: PackageMetadata
  ): Promise<{artifactDirectory:string,artifactMetadataFilePath:string,artifactSourceDirectory:string,changelogDirectory:string}> {

    try {
      let abs_artifact_directory: string;

      if(!isNullOrUndefined(artifact_directory))
      {
          abs_artifact_directory = path.resolve(artifact_directory);
      }
      else
      {
          abs_artifact_directory=process.cwd();

      }

      let aritfactDirectory = isNullOrUndefined(sfdx_package)?"sfpowerscripts_artifact":`${sfdx_package}_sfpowerscripts_artifact`;


      let sfdx_package_artifact: string = path.join(
        abs_artifact_directory,
        aritfactDirectory
      );


      fs.mkdirpSync(sfdx_package_artifact);

      let sourcePackage: string = path.join(
        sfdx_package_artifact,
        `source`
      );
      fs.mkdirpSync(sourcePackage);
      fs.copySync(packageArtifactMetadata.sourceDir, sourcePackage);

      rimraf.sync(packageArtifactMetadata.sourceDir);



      //Modify Source Directory to the new source directory inside the artifact
      packageArtifactMetadata.sourceDir=`source`;

      let artifactMetadataFilePath: string = path.join(
        sfdx_package_artifact,
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
        packageArtifactMetadata.sourceVersionTo ? packageArtifactMetadata.sourceVersionTo : packageArtifactMetadata.sourceVersion,
        project_directory
      );

      let packageChangelog: Changelog = await generatePackageChangelog.exec();

      let changelogFilepath: string = path.join(
        sfdx_package_artifact,
        `changelog.json`
      );

      fs.writeFileSync(
        changelogFilepath,
        JSON.stringify(packageChangelog, null, 4)
      );

      Logger.log("Artifact Copy Completed");

      return {
        artifactDirectory: path.resolve(abs_artifact_directory, aritfactDirectory),
        artifactMetadataFilePath: artifactMetadataFilePath,
        artifactSourceDirectory: sourcePackage,
        changelogDirectory: changelogFilepath
      };
    } catch (error) {
      throw new Error("Unable to create artifact" + error);
    }
  }
}
