import tl = require("azure-pipelines-task-lib/task");
import InstallDataPackageImpl from "@dxatscale/sfpowerscripts.core/lib/sfdxwrappers/InstallDataPackageImpl";
import PackageMetadata from "@dxatscale/sfpowerscripts.core/lib/PackageMetadata";
import * as ExtensionManagementApi from "azure-devops-node-api/ExtensionManagementApi";
import { getWebAPIWithoutToken } from "../Common/WebAPIHelper";
import ArtifactFilePathFetcher from "@dxatscale/sfpowerscripts.core/lib/artifacts/ArtifactFilePathFetcher";
import ManifestHelpers from "@dxatscale/sfpowerscripts.core/lib/manifest/ManifestHelpers";
import {
  getExtensionName,
  fetchPackageArtifactFromStorage,
  updatePackageDeploymentDetails,
} from "../Common/PackageExtensionStorageHelper";
import ArtifactHelper from "../Common/ArtifactHelper";
const fs = require("fs");
const path = require("path");
import SFPStatsSender from "@dxatscale/sfpowerscripts.core/lib/utils/SFPStatsSender"

async function run() {
  try {
    console.log("Install Data Package To Org");
    let startTime=Date.now();

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

    let sourceDirectory;
    // Get package source directory from sfdx-project.json in sourceDirectoryPath
    sourceDirectory = ManifestHelpers.getSFDXPackageDescriptor(
      artifacts_filepaths[0].sourceDirectoryPath,
      sfdx_package
    )["path"];

    console.log("Path for the project", sourceDirectory);
    if (subdirectory != null) {
      sourceDirectory =  path.join(sourceDirectory, subdirectory);

      // Check whether the absolute source directory path exists
      let absSourceDirectory = path.join(
        artifacts_filepaths[0].sourceDirectoryPath,
        sourceDirectory
      );
      if (!fs.existsSync(absSourceDirectory)) {
        throw new Error(`Source directory ${absSourceDirectory} does not exist`);
      }
    }

    let installDataPackageImpl: InstallDataPackageImpl = new InstallDataPackageImpl(
      target_org,
      artifacts_filepaths[0].sourceDirectoryPath,
      sourceDirectory
    )

    await installDataPackageImpl.exec();


    let elapsedTime=Date.now()-startTime;

    SFPStatsSender.logElapsedTime("package.installation.elapsed_time",elapsedTime,{package:sfdx_package,sub_directory: subdirectory,type:"data"})
    SFPStatsSender.logCount("package.installation",{package:sfdx_package, sub_directory: subdirectory,type:"data"})


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

    tl.setResult(tl.TaskResult.Succeeded, "Package installed successfully");

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
