import tl = require("azure-pipelines-task-lib/task");
import PromoteUnlockedPackageImpl from "@dxatscale/sfpowerscripts.core/lib/sfdxwrappers/PromoteUnlockedPackageImpl";
import ArtifactFilePathFetcher from "../Common/ArtifactFilePathFetcher";
import PackageMetadata from "@dxatscale/sfpowerscripts.core/lib/PackageMetadata";
import { isNullOrUndefined } from "util";
var fs = require("fs");


async function run() {
  try {
    console.log(`SFPowerScript.. Promote Unlocked Package`);

    const package_installedfrom = tl.getInput("packagepromotedfrom", true);
    const sfdx_package: string = tl.getInput("package", true);
    const devhub_alias = tl.getInput("devhub_alias", true);
    const projectDirectory = tl.getInput("project_directory", false);
    const artifact = tl.getInput("artifact", false);
    const skip_on_missing_artifact = tl.getBoolInput(
      "skip_on_missing_artifact",
      false
    );

    let package_version_id,sourceDirectory;

    if (package_installedfrom == "Custom") {
      package_version_id = tl.getInput("package_version_id", false);
      sourceDirectory = projectDirectory;
    } else {
     
       //Fetch Artifact
       let artifactFilePathFetcher = new ArtifactFilePathFetcher(
        sfdx_package,
        artifact,
        package_installedfrom
      );
      let artifactFilePaths = artifactFilePathFetcher.fetchArtifactFilePaths();
      artifactFilePathFetcher.missingArtifactDecider(
        artifactFilePaths.packageMetadataFilePath,
        skip_on_missing_artifact
      );


      //Read package metadata
      let packageMetadataFromArtifact: PackageMetadata = JSON.parse(fs.readFileSync(artifactFilePaths.packageMetadataFilePath, "utf8"));

      
      console.log("##[command]Package Metadata:"+JSON.stringify(packageMetadataFromArtifact,(key:string,value:any)=>{
        if(key=="payload")
          return undefined;
        else
          return value;
     }));

      package_version_id = packageMetadataFromArtifact.package_version_id;
      console.log(`Using Package Version Id ${package_version_id}`);

     // Get Source Directory
      sourceDirectory = artifactFilePaths.sourceDirectoryPath;

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
