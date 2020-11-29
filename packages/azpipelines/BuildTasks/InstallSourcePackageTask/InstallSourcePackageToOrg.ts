import tl = require("azure-pipelines-task-lib/task");
import { isNullOrUndefined } from "util";

import PackageMetadata from "@dxatscale/sfpowerscripts.core/lib/PackageMetadata";
import * as ExtensionManagementApi from "azure-devops-node-api/ExtensionManagementApi";
import { getWebAPIWithoutToken } from "../Common/WebAPIHelper";
import ArtifactFilePathFetcher from "@dxatscale/sfpowerscripts.core/lib/artifacts/ArtifactFilePathFetcher";
import InstallSourcePackageImpl from "@dxatscale/sfpowerscripts.core/lib/sfdxwrappers/InstallSourcePackageImpl";
import SFPStatsSender from "@dxatscale/sfpowerscripts.core/lib/utils/SFPStatsSender";

import {
  getExtensionName,
  fetchPackageArtifactFromStorage,
  updatePackageDeploymentDetails,
} from "../Common/PackageExtensionStorageHelper";
import ArtifactHelper from "../Common/ArtifactHelper";
import { PackageInstallationStatus } from "@dxatscale/sfpowerscripts.core/lib/package/PackageInstallationResult";
const fs = require("fs-extra");


async function run() {
  try {
    console.log("sfpowerscripts.Install Source Package To Org");

    const target_org: string = tl.getInput("target_org", true);
    const sfdx_package: string = tl.getInput("package", false);
    const artifactDir = tl.getInput("artifactDir", false);
    const skip_on_missing_artifact = tl.getBoolInput(
      "skip_on_missing_artifact",
      false
    );
    const subdirectory: string = tl.getInput("subdirectory", false);
    const optimizeDeployment: boolean = tl.getBoolInput(
      "optimizeDeployment",
      false
    );
    const skipTesting: boolean = tl.getBoolInput("skipTesting", false);
    const wait_time: string = tl.getInput("wait_time", false);
    const skip_if_package_installed: boolean = tl.getBoolInput(
      "skip_if_package_installed",
      false
    );

    //WebAPI Initialization
    const webApi = await getWebAPIWithoutToken();
    const extensionManagementApi: ExtensionManagementApi.IExtensionManagementApi = await webApi.getExtensionManagementApi();
    let extensionName = await getExtensionName(extensionManagementApi);

    //Initialize StatsD
    SFPStatsSender.initialize(
      tl.getVariable("SFPOWERSCRIPTS_STATSD_PORT"),
      tl.getVariable("SFPOWERSCRIPTS_STATSD_HOST"),
      tl.getVariable("SFPOWERSCRIPTS_STATSD_PROTOCOL")
    );



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
        JSON.stringify(
          packageMetadataFromArtifact,
          (key: string, value: any) => {
            if (key == "payload") return undefined;
            else return value;
          }
        )
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

    let options = {
      optimizeDeployment: optimizeDeployment,
      skipTesting: skipTesting,
    };

    let installSourcePackageImpl: InstallSourcePackageImpl = new InstallSourcePackageImpl(
      sfdx_package,
      target_org,
      artifacts_filepaths[0].sourceDirectoryPath,
      subdirectory,
      options,
      wait_time,
      skip_if_package_installed,
      packageMetadataFromStorage,
      true
    );

    let result = await installSourcePackageImpl.exec();

    //No environment info available, create and push
    if ((result.result == PackageInstallationStatus.Succeeded)) {
      if (isNullOrUndefined(packageMetadataFromStorage.deployments)) {
        packageMetadataFromStorage.deployments = new Array();
        packageMetadataFromStorage.deployments.push({
          target_org: target_org,
          sub_directory: subdirectory,
          timestamp: Date.now()
        });
        tl.setVariable("sfpowerscripts_installsourcepackage_deployment_id", result.deploy_id);
      } else {
        //Update existing environment map
        packageMetadataFromStorage.deployments.push({
          target_org: target_org,
          sub_directory: subdirectory,
          timestamp: Date.now()
        });
      }

      await updatePackageDeploymentDetails(
        packageMetadataFromStorage,
        extensionManagementApi,
        extensionName
      );
      tl.setResult(tl.TaskResult.Succeeded, result.message);
    } else {
      tl.error(result.message);
      tl.setResult(
        tl.TaskResult.Failed,
        `Validation/Deployment with Job ID ${result.deploy_id} failed`
      );
    }
  } catch (err) {
    SFPStatsSender.logCount("package.installation.failure", {
      package: tl.getInput("package", false),
      type: "source",
    });
    tl.setResult(tl.TaskResult.Failed, err.message);
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
