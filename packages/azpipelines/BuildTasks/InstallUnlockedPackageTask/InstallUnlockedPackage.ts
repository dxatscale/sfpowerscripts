import tl = require("azure-pipelines-task-lib/task");
import InstallUnlockedPackageImpl, {
  PackageInstallationResult,
} from "@dxatscale/sfpowerscripts.core/lib/sfdxwrappers/InstallUnlockedPackageImpl";
import ArtifactFilePathFetcher from "@dxatscale/sfpowerscripts.core/lib/artifacts/ArtifactFilePathFetcher";
import PackageMetadata from "@dxatscale/sfpowerscripts.core/lib/PackageMetadata";
import { getWebAPIWithoutToken } from "../Common/WebAPIHelper";
import {
  getExtensionName,
  fetchPackageArtifactFromStorage,
  updatePackageDeploymentDetails,
} from "../Common/PackageExtensionStorageHelper";
import { isNullOrUndefined } from "util";
import ArtifactHelper from "../Common/ArtifactHelper";
import SFPStatsSender from "@dxatscale/sfpowerscripts.core/lib/utils/SFPStatsSender"
const fs = require("fs");


async function run() {
  try {
    const target_org: string = tl.getInput("target_org", true);
    const sfdx_package: string = tl.getInput("package", true);
    const package_installedfrom = tl.getInput("packageinstalledfrom", true);
    const artifactDir = tl.getInput("artifactDir", false);
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
     let startTime=Date.now();

     //WebAPI Initialization
     const webApi = await getWebAPIWithoutToken();
     const extensionManagementApi = await webApi.getExtensionManagementApi();
     let extensionName = await getExtensionName(extensionManagementApi);


     //Initialize StatsD
     SFPStatsSender.initialize(tl.getVariable("SFPOWERSCRIPTS_STATSD_PORT"),tl.getVariable("SFPOWERSCRIPTS_STATSD_HOST"),tl.getVariable("SFPOWERSCRIPTS_STATSD_PROTOCOL"));


    if (package_installedfrom == "Custom") {
      package_version_id = tl.getInput("package_version_id", false);
    } else {

      //Fetch Artifact
      let artifacts_filepaths = ArtifactFilePathFetcher.fetchArtifactFilePaths(
        ArtifactHelper.getArtifactDirectory(artifactDir),
        sfdx_package
      );

      ArtifactHelper.skipTaskWhenArtifactIsMissing(
        ArtifactFilePathFetcher.missingArtifactDecider(
          artifacts_filepaths,
          skip_on_missing_artifact
        )
      );

      let packageMetadataFromArtifact: PackageMetadata = JSON.parse(fs.readFileSync(artifacts_filepaths[0].packageMetadataFilePath, "utf8"));


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


    let installUnlockedPackageImpl: InstallUnlockedPackageImpl = new InstallUnlockedPackageImpl(
      package_version_id,
      target_org,
      options,
      wait_time,
      publish_wait_time,
      skip_if_package_installed,
      packageMetadataFromStorage
    );

    let elapsedTime=Date.now()-startTime;
      
    SFPStatsSender.logElapsedTime("package.installation.elapsed_time",elapsedTime,{package:sfdx_package,type:"unlocked", target_org:target_org})
    SFPStatsSender.logCount("package.installation",{package:sfdx_package,type:"unlocked",target_org:target_org})



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
            installation_time:elapsedTime,
            timestamp:Date.now()
          });
        } else {
          //Update existing environment map
          packageMetadataFromStorage.deployments.push({
            target_org: target_org,
            sub_directory: null,
            installation_time:elapsedTime,
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
    SFPStatsSender.logCount("package.installation.failure",{package:tl.getInput("package",false),type:"unlocked"})
    tl.setResult(tl.TaskResult.Failed, err.message);
 
  }
}

run();
