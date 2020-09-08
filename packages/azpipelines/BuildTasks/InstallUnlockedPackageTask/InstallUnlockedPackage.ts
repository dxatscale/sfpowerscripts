import tl = require("azure-pipelines-task-lib/task");
import InstallUnlockedPackageImpl, {
  PackageInstallationResult,
} from "@dxatscale/sfpowerscripts.core/lib/sfdxwrappers/InstallUnlockedPackageImpl";
import ArtifactFilePathFetcher from "../Common/ArtifactFilePathFetcher";
import PackageMetadata from "@dxatscale/sfpowerscripts.core/lib/PackageMetadata";
import { getWebAPIWithoutToken } from "../Common/WebAPIHelper";
import {
  getExtensionName,
  fetchPackageArtifactFromStorage,
  updatePackageDeploymentDetails,
} from "../Common/PackageExtensionStorageHelper";
import { isNullOrUndefined } from "util";
const fs = require("fs");


async function run() {
  try {
    const target_org: string = tl.getInput("envname", true);
    const sfdx_package: string = tl.getInput("package", true);
    const package_installedfrom = tl.getInput("packageinstalledfrom", true);
    const artifact = tl.getInput("artifact", false);
    const skip_on_missing_artifact = tl.getBoolInput(
      "skip_on_missing_artifact",
      false
    );
    const installationkey = tl.getInput("installationkey", false);
    const apexcompileonlypackage = tl.getBoolInput(
      "apexcompileonlypackage",
      false
    );
    const security_type = tl.getInput("security_type", false);
    const upgrade_type = tl.getInput("upgrade_type", false);
    const wait_time = tl.getInput("wait_time", false);
    const publish_wait_time = tl.getInput("publish_wait_time", false);
    const skip_if_package_installed = tl.getBoolInput(
      "skip_if_package_installed",
      false
    );

     let package_version_id: string;
     let packageMetadataFromStorage:PackageMetadata;
 
     //WebAPI Initialization
     const webApi = await getWebAPIWithoutToken();
     const extensionManagementApi = await webApi.getExtensionManagementApi();
     let extensionName = await getExtensionName(extensionManagementApi);



    if (package_installedfrom == "Custom") {
      package_version_id = tl.getInput("package_version_id", false);
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

      let packageMetadataFromArtifact: PackageMetadata = JSON.parse(fs.readFileSync(artifactFilePaths.packageMetadataFilePath, "utf8"));

      
      console.log("##[command]Package Metadata:"+JSON.stringify(packageMetadataFromArtifact,(key:string,value:any)=>{
        if(key=="payload")
          return undefined;
        else
          return value;
     }));


      package_version_id = packageMetadataFromArtifact.package_version_id;
      console.log(`Using Package Version Id ${package_version_id}`);

      packageMetadataFromStorage = await fetchPackageArtifactFromStorage(
        packageMetadataFromArtifact,
        extensionManagementApi,
        extensionName
      );
    }

    let options = {
      installationkey: installationkey,
      apexcompile: apexcompileonlypackage ? `package` : `all`,
      securitytype: security_type,
      upgradetype: upgrade_type,
    };

    let startTime=Date.now();
    let installUnlockedPackageImpl: InstallUnlockedPackageImpl = new InstallUnlockedPackageImpl(
      package_version_id,
      target_org,
      options,
      wait_time,
      publish_wait_time,
      skip_if_package_installed
    );
    let endTime=Date.now()-startTime;

    let result: PackageInstallationResult = await installUnlockedPackageImpl.exec();
    if (result == PackageInstallationResult.Skipped) {
      tl.setResult(
        tl.TaskResult.Skipped,
        "Skipping Package Installation as already installed"
      );
    } else {
      if (package_installedfrom != "Custom") {
        //No environment info available, create and push
        if (isNullOrUndefined(packageMetadataFromStorage.deployments)) {
          packageMetadataFromStorage.deployments = new Array();
          packageMetadataFromStorage.deployments.push({
            target_org: target_org,
            sub_directory: null,
            installation_time:endTime,
            timestamp:Date.now()
          });
        } else {
          //Update existing environment map
          packageMetadataFromStorage.deployments.push({
            target_org: target_org,
            sub_directory: null,
            installation_time:endTime,
            timestamp:Date.now()
          });
        }

        await updatePackageDeploymentDetails(
          packageMetadataFromStorage,
          extensionManagementApi,
          extensionName
        );
      }

      tl.setResult(tl.TaskResult.Succeeded, "Package Installed Successfully");
    }
  } catch (err) {
    tl.setResult(tl.TaskResult.Failed, err.message);
  }
}

run();
