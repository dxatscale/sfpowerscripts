import tl = require("azure-pipelines-task-lib/task");
import InstallDataPackageImpl from "@dxatscale/sfpowerscripts.core/lib/sfdxwrappers/InstallDataPackageImpl";
import PackageMetadata from "@dxatscale/sfpowerscripts.core/lib/PackageMetadata";
import * as ExtensionManagementApi from "azure-devops-node-api/ExtensionManagementApi";
import { getWebAPIWithoutToken } from "../Common/WebAPIHelper";
import ArtifactFilePathFetcher from "@dxatscale/sfpowerscripts.core/lib/artifacts/ArtifactFilePathFetcher";
import {
  getExtensionName,
  fetchPackageArtifactFromStorage,
  updatePackageDeploymentDetails,
} from "../Common/PackageExtensionStorageHelper";
import ArtifactHelper from "../Common/ArtifactHelper";
const fs = require("fs");
import SFPStatsSender from "@dxatscale/sfpowerscripts.core/lib/utils/SFPStatsSender"
import { PackageInstallationStatus } from "@dxatscale/sfpowerscripts.core/lib/package/PackageInstallationResult";

async function run() {
  try {
    console.log("Install Data Package To Org");
    const startTime=Date.now();
    const target_org: string = tl.getInput("target_org", true);
    const sfdx_package: string = tl.getInput("package", true);
    const artifactDir = tl.getInput("artifactDir", false);
    const skip_on_missing_artifact = tl.getBoolInput(
      "skip_on_missing_artifact",
      false
    );
    const subdirectory: string = tl.getInput("subdirectory", false);
    const skip_if_package_installed: boolean = tl.getBoolInput(
      "skip_if_package_installed",
      false
    );

    //WebAPI Initialization
    const webApi = await getWebAPIWithoutToken();
    const extensionManagementApi: ExtensionManagementApi.IExtensionManagementApi = await webApi.getExtensionManagementApi();
    let extensionName = await getExtensionName(extensionManagementApi);

   //Initialize StatsD
   SFPStatsSender.initialize(tl.getVariable("SFPOWERSCRIPTS_STATSD_PORT"),tl.getVariable("SFPOWERSCRIPTS_STATSD_HOST"),tl.getVariable("SFPOWERSCRIPTS_STATSD_PROTOCOL"));


    //Fetch Artifact
    let artifacts_filepaths = ArtifactFilePathFetcher.fetchArtifactFilePaths(
      ArtifactHelper.getArtifactDirectory(artifactDir),
      sfdx_package
    );
    console.log(
      "##[debug]Artifacts Paths",
      JSON.stringify(artifacts_filepaths)
    );

    ArtifactHelper.skipTaskWhenArtifactIsMissing(
      ArtifactFilePathFetcher.missingArtifactDecider(
        artifacts_filepaths,
        skip_on_missing_artifact
      )
    );

    let packageMetadataFromArtifact: PackageMetadata = JSON.parse(
      fs.readFileSync(artifacts_filepaths[0].packageMetadataFilePath, "utf8")
    );

    let packageMetadataFromStorage: PackageMetadata = await fetchPackageArtifactFromStorage(
      packageMetadataFromArtifact,
      extensionManagementApi,
      extensionName
    );

    console.log(
      "##[command]Package Metadata:" +
      JSON.stringify(packageMetadataFromArtifact)
    );

    if (
      skip_if_package_installed &&
      checkPackageIsInstalled(
        packageMetadataFromStorage,
        target_org,
        subdirectory
      )
    ) {
      tl.setResult(
        tl.TaskResult.Skipped,
        "Skipping Package Installation as already installed"
      );
      return;
    }


    let installDataPackageImpl: InstallDataPackageImpl = new InstallDataPackageImpl(
      sfdx_package,
      target_org,
      artifacts_filepaths[0].sourceDirectoryPath,
      subdirectory,
      packageMetadataFromStorage,
      skip_if_package_installed,
      true
    )

    let result = await installDataPackageImpl.exec();


    let elapsedTime=Date.now()-startTime;


    if (result.result === PackageInstallationStatus.Succeeded) {
      //No environment info available, create and push
      if (packageMetadataFromStorage.deployments == null) {
        packageMetadataFromStorage.deployments = new Array();
        packageMetadataFromStorage.deployments.push({
          target_org: target_org,
          sub_directory: subdirectory,
          installation_time:elapsedTime,
          timestamp:Date.now()
        });
      } else {
        //Update existing environment map
        packageMetadataFromStorage.deployments.push({
          target_org: target_org,
          sub_directory: subdirectory,
          installation_time:elapsedTime,
          timestamp:Date.now()
        });
      }

      await updatePackageDeploymentDetails(
        packageMetadataFromStorage,
        extensionManagementApi,
        extensionName
      );


      SFPStatsSender.logElapsedTime("package.installation.elapsed_time",elapsedTime,{package:sfdx_package,type:"data", target_org:target_org});
      SFPStatsSender.logCount("package.installation",{package:sfdx_package,type:"data",target_org:target_org});


      tl.setResult(tl.TaskResult.Succeeded, "Package installed successfully");
    } else if (result.result === PackageInstallationStatus.Failed) {
      tl.setResult(tl.TaskResult.Failed, result.message);

      SFPStatsSender.logCount("package.installation.failure",{package:tl.getInput("package",false),type:"data"});
    }


  } catch (err) {

    tl.setResult(tl.TaskResult.Failed, err.message);

    SFPStatsSender.logCount("package.installation.failure",{package:tl.getInput("package",false),type:"data"})
  }
}


function checkPackageIsInstalled(
  packageMetadata: PackageMetadata,
  target_org: string,
  subdirectory: string
) {
  if (packageMetadata.deployments != null) {
    for (const deployment of packageMetadata.deployments) {
      if (
        target_org == deployment.target_org &&
        subdirectory == deployment.sub_directory
      ) {
        return true;
      }
    }
  }
  return false;
}

run();
