import path = require("path");
import fs = require("fs-extra");
import PackageMetadata from "../PackageMetadata";
import { isNullOrUndefined } from "util";
import * as rimraf from "rimraf";

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
        JSON.stringify(packageArtifactMetadata)
      );


      console.log("Artifact Copy Completed");

      return {artifactDirectory: path.resolve(abs_artifact_directory, aritfactDirectory),artifactMetadataFilePath:artifactMetadataFilePath,artifactSourceDirectory:sourcePackage};
    } catch (error) {
      throw new Error("Unable to create artifact" + error);
    }
  }
}


