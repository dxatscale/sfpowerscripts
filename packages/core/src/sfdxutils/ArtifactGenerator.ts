import path = require("path");
import fs = require("fs-extra");
import PackageMetadata from "../sfdxwrappers/PackageMetadata";
import { isNullOrUndefined } from "util";
import { constants } from "os";

export default class ArtifactGenerator {


  //Generates the universal artifact used by the CLI and AZP
  public static generateArtifact(
    sfdx_package: string,
    project_directory: string,
    artifact_directory: string,
    packageArtifactMetadata: PackageMetadata
  ): {artifactDirectory:string,artifactMetadataFilePath:string,artifactSourceDirectory:string} {

    try {
      let abs_artifact_directory: string;

      if(!isNullOrUndefined(artifact_directory))
      {
        if (!isNullOrUndefined(project_directory)) {
          abs_artifact_directory = path.resolve(
            project_directory,
            artifact_directory
          );
        } else {
          abs_artifact_directory = path.resolve(artifact_directory);
        }
      }
      else
      {
        if (!isNullOrUndefined(project_directory)) {
          abs_artifact_directory = path.resolve(
            project_directory
          );
        }
        else
        {
          abs_artifact_directory=process.cwd();
        }
      }
     

      let sfdx_package_artifact: string = path.join(
        abs_artifact_directory,
        `${sfdx_package}_artifact`
      );

      
      fs.mkdirpSync(sfdx_package_artifact);
      console.log("Artifact Directory Created at:",sfdx_package_artifact);

      let sourcePackage: string = path.join(
        sfdx_package_artifact,
        `${sfdx_package}_sfpowerscripts_source_package`
      );
      fs.mkdirpSync(sourcePackage);
      fs.copySync(packageArtifactMetadata.sourceDir, sourcePackage);

      let artifactMetadataFilePath: string = path.join(
        sfdx_package_artifact,
        `${sfdx_package}_artifact_metadata`
      );

      fs.writeFileSync(
        artifactMetadataFilePath,
        JSON.stringify(packageArtifactMetadata)
      );

      console.log("Artifact Copy Completed");

      return {artifactDirectory: path.resolve(abs_artifact_directory, `${sfdx_package}_artifact`),artifactMetadataFilePath:artifactMetadataFilePath,artifactSourceDirectory:sourcePackage};
    } catch (error) {
      throw new Error("Unable to create artifact" + error);
    }
  }
}


