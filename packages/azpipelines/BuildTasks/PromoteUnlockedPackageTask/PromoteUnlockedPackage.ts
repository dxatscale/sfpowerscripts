import tl = require("azure-pipelines-task-lib/task");
import PromoteUnlockedPackageImpl from "@dxatscale/sfpowerscripts.core/lib/sfdxwrappers/PromoteUnlockedPackageImpl";
import ArtifactFilePathFetcher from "@dxatscale/sfpowerscripts.core/src/artifacts/ArtifactFilePathFetcher";
import PackageMetadata from "@dxatscale/sfpowerscripts.core/lib/PackageMetadata";
import { isNullOrUndefined } from "util";
import ArtifactHelper from "../Common/ArtifactHelper";
const fs = require("fs");


async function run() {
  try {
    console.log(`sfpowerscripts.. Promote Unlocked Package`);


    const sfdx_package: string = tl.getInput("package", true);
    const artifactDir = tl.getInput("aritfactDir",false);
    const devhub_alias = tl.getInput("devhub_alias", true);
    const skip_on_missing_artifact = tl.getBoolInput(
      "skip_on_missing_artifact",
      false
    );

    let package_version_id,sourceDirectory;

 

       //Fetch Artifact
      let artifactFilePaths = ArtifactFilePathFetcher.fetchArtifactFilePaths(
        ArtifactHelper.getArtifactDirectory(artifactDir),
        sfdx_package
      );
      let isToBeSkipped=ArtifactFilePathFetcher.missingArtifactDecider(
        artifactFilePaths[0].packageMetadataFilePath,
        skip_on_missing_artifact
      );
      ArtifactHelper.skipTaskWhenArtifactIsMissing(isToBeSkipped);
      

      //Read package metadata
      let packageMetadataFromArtifact: PackageMetadata = JSON.parse(fs.readFileSync(artifactFilePaths[0].packageMetadataFilePath, "utf8"));


      console.log("##[command]Package Metadata:"+JSON.stringify(packageMetadataFromArtifact,(key:string,value:any)=>{
        if(key=="payload")
          return undefined;
        else
          return value;
     }));

      package_version_id = packageMetadataFromArtifact.package_version_id;
      console.log(`Using Package Version Id ${package_version_id}`);

     // Get Source Directory
      sourceDirectory = artifactFilePaths[0].sourceDirectoryPath;

      if(sourceDirectory==null)
      { //Compatiblity Reasons

       //Check whether projectDirectory is provided..
       if(isNullOrUndefined(projectDirectory))
        {
          tl.setResult(tl.TaskResult.Failed,"Path to the project directory with sfdx-project.json is required, Either provide the parameter, or update your package creation task to make use of new updates in package artifact");
          return;
        }
        else
        {
          sourceDirectory = projectDirectory
        }
      }


    

    let promoteUnlockedPackageImpl: PromoteUnlockedPackageImpl = new PromoteUnlockedPackageImpl(
      sourceDirectory,
      package_version_id,
      devhub_alias
    );

    await promoteUnlockedPackageImpl.exec();
  } catch (err) {
    tl.setResult(tl.TaskResult.Failed, err.message);
  }
}



run();
