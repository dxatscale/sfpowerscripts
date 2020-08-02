import tl = require("azure-pipelines-task-lib/task");
import { isNullOrUndefined } from "util";
import DeploySourceToOrgImpl from "@dxatscale/sfpowerscripts.core/lib/sfdxwrappers/DeploySourceToOrgImpl";
import DeploySourceResult from "@dxatscale/sfpowerscripts.core/lib/sfdxwrappers/DeploySourceResult";
import getOrgDetails from "@dxatscale/sfpowerscripts.core/lib/getOrgDetails";
import PackageMetadata from "@dxatscale/sfpowerscripts.core/lib/sfdxwrappers/PackageMetadata";
import * as ExtensionManagementApi from "azure-devops-node-api/ExtensionManagementApi";
import { getWebAPIWithoutToken } from "../Common/WebAPIHelper";

const fs = require("fs");
const path = require("path");

const PUBLISHER_NAME = "AzlamSalam";
const SCOPE_TYPE = "Default";
const SCOPE_VALUE = "Current";

async function run() {
  try {
    console.log("sfpowerscrits..Install Source Package To Org");

    const target_org: string = tl.getInput("target_org", true);
    const sfdx_package: string = tl.getInput("package", true);
    const package_installedfrom = tl.getInput("packageinstalledfrom", true);
    const artifact = tl.getInput("artifact", false);
    const skip_on_missing_artifact = tl.getBoolInput(
      "skip_on_missing_artifact",
      false
    );
    const subdirectory = tl.getInput("subdirectory", false);
    const upgrade_type = tl.getInput("upgrade_type", false);
    const wait_time = tl.getInput("wait_time", false);
    const skip_if_package_installed = tl.getBoolInput(
      "skip_if_package_installed",
      false
    );

    //WebAPI Initialization
    const webApi = await getWebAPIWithoutToken();
    const extensionManagementApi: ExtensionManagementApi.IExtensionManagementApi = await webApi.getExtensionManagementApi();
    let extensionName = await getExtensionName(extensionManagementApi);

    //Fetch Artifact
    let artifactFilePaths: { metadataFilePath: string; sourceFilePath: string };

    if (package_installedfrom == "BuildArtifact")
      artifactFilePaths = fetchArtifactFilePathFromBuildArtifact(
        sfdx_package,
        artifact
      );
    else if (package_installedfrom == "AzureArtifact")
      artifactFilePaths = fetchArtifactFilePathFromAzureArtifact(
        sfdx_package,
        artifact
      );

    missingArtifactDecider(
      artifactFilePaths.metadataFilePath,
      skip_on_missing_artifact
    );

    let packageMetadataFromArtifact: PackageMetadata = JSON.parse(
      fs.readFileSync(artifactFilePaths.metadataFilePath).toString()
    );
    console.log(
      "Package Metadata:",
      JSON.stringify(packageMetadataFromArtifact)
    );
    console.log("Package Artifact Location", artifactFilePaths.sourceFilePath);

    let packageMetadataFromStorage = await fetchPackageArtifactFromStorage(
      packageMetadataFromArtifact,
      extensionManagementApi,
      extensionName
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

    

    let sourceDirectory = sfdx_package;
    if (!isNullOrUndefined(subdirectory)) {
      sourceDirectory = path.join(sfdx_package, subdirectory);
    }

    //Construct Deploy Command
    let deploySourceToOrgImpl: DeploySourceToOrgImpl = new DeploySourceToOrgImpl(
      target_org,
      artifactFilePaths.sourceFilePath,
      sourceDirectory,
      generateDeploymentOptions(
        wait_time,
        packageMetadataFromStorage.apextestsuite,
        target_org
      ),
      false
    );

    let result: DeploySourceResult = await deploySourceToOrgImpl.exec();

    if (!isNullOrUndefined(result.deploy_id)) {
      tl.setVariable("sfpowerkit_deploysource_id", result.deploy_id);
    }

    if (result.result) {

      //No environment info available, create and push
      if (isNullOrUndefined(packageMetadataFromStorage.deployments)) {
        packageMetadataFromStorage.deployments = new Array();
        packageMetadataFromStorage.deployments.push({
          target_org: target_org,
          sub_directory: subdirectory,
        });
      } else {
        //Update existing environment map
        packageMetadataFromStorage.deployments.push({
          target_org: target_org,
          sub_directory: subdirectory,
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
    tl.setResult(tl.TaskResult.Failed, err.message);
  }
}

function generateDeploymentOptions(
  wait_time: string,
  apextextsuite: string,
  target_org: string
): any {
  let mdapi_options = {};
  mdapi_options["ignore_warnings"] = true;
  mdapi_options["wait_time"] = wait_time;

  if (!isNullOrUndefined(apextextsuite)) {
    mdapi_options["testlevel"] = "RunApexTestSuite";
    mdapi_options["apextestsuite"] = apextextsuite;
  } else {
    //Determine test option
    try {
      let result = getOrgDetails(target_org);
      if (result["IsSandbox"]) {
        //Its a sandbox org, and no apex test suite skip tests
        mdapi_options["testlevel"] = "NoTestRun"; //Just ignore tests
        mdapi_options["specified_tests"] = "skip";
      } else {
        mdapi_options["testlevel"] = "RunSpecifiedTests"; //Just ignore tests
        mdapi_options["specified_tests"] = "skip";
      }
    } catch (error) {
      console.log(
        "Unable to fetch Org Details, Proceeding as if its Production Org"
      );
      mdapi_options["testlevel"] = "RunSpecifiedTests";
      mdapi_options["specified_tests"] = "skip"; //Just ignore tests
    }
  }
  return mdapi_options;
}

function fetchArtifactFilePathFromBuildArtifact(
  sfdx_package: string,
  artifact: string
): { metadataFilePath: string; sourceFilePath: string } {
  let artifact_directory = tl.getVariable("system.artifactsDirectory");

  //Metadata FilePath
  let metadataFilePath: string = path.join(
    artifact_directory,
    artifact,
    "sfpowerkit_artifact",
    `${sfdx_package}_artifact_metadata`
  );

  let sourceFilePath: string = path.join(
    artifact_directory,
    artifact,
    `${sfdx_package}_sfpowerscripts_source_package`
  );

  console.log(
    `Checking for ${sfdx_package} Build Artifact at path ${metadataFilePath}`
  );

  return { metadataFilePath: metadataFilePath, sourceFilePath: sourceFilePath };
}

function fetchArtifactFilePathFromAzureArtifact(
  sfdx_package: string,
  artifact: string
): { metadataFilePath: string; sourceFilePath: string } {
  let artifact_directory = tl.getVariable("system.artifactsDirectory");

  let metadataFilePath = path.join(
    artifact_directory,
    artifact,
    `${sfdx_package}_artifact_metadata`
  );

  let sourceFilePath: string = path.join(
    artifact_directory,
    artifact,
    `${sfdx_package}_sfpowerscripts_source_package`
  );

  console.log(
    `Checking for ${sfdx_package} Azure Artifact at path ${metadataFilePath}`
  );

  return { metadataFilePath: metadataFilePath, sourceFilePath: sourceFilePath };
}

function missingArtifactDecider(
  package_version_id_file_path: string,
  skip_on_missing_artifact: boolean
): void {
  if (
    !fs.existsSync(package_version_id_file_path) &&
    !skip_on_missing_artifact
  ) {
    throw new Error(
      `Artifact not found at ${package_version_id_file_path}.. Please check the inputs`
    );
  } else if (
    !fs.existsSync(package_version_id_file_path) &&
    skip_on_missing_artifact
  ) {
    console.log(
      `Skipping task as artifact is missing, and 'Skip If no artifact is found' ${skip_on_missing_artifact}`
    );
    tl.setResult(
      tl.TaskResult.Skipped,
      `Skipping task as artifact is missing, and 'Skip If no artifact is found' ${skip_on_missing_artifact}`
    );
    process.exit(0);
  }
}

function checkPackageIsInstalled(
  packageMetadata: PackageMetadata,
  target_org: string,
  subdirectory: string
) {
  
  if(packageMetadata.deployments!=null)
  {
   for (const deployment of packageMetadata.deployments) {
     if(target_org == deployment.target_org  && subdirectory == deployment.sub_directory)
     {
       return true;
     }
   }
  }
  return false;
}

async function fetchPackageArtifactFromStorage(
  packageMetadata: PackageMetadata,
  extensionManagementApi: ExtensionManagementApi.IExtensionManagementApi,
  extensionName: string
): Promise<PackageMetadata> {
  try {
    let documentId: string =
      packageMetadata.package_name +
      packageMetadata.package_version_number.replace(".", "_");

    let response: PackageMetadata = await extensionManagementApi.getDocumentByName(
      PUBLISHER_NAME,
      extensionName,
      SCOPE_TYPE,
      SCOPE_VALUE,
      "sfpowerscripts_source_packages",
      documentId
    );
    if (response != null) {
      tl.debug(
        "Successfully retrived package details:" + JSON.stringify(response)
      );
      return response;
    } else return packageMetadata;
  } catch (error) {
    tl.debug(error);
    return packageMetadata;
  }
}

async function updatePackageDeploymentDetails(
  packageMetadata: PackageMetadata,
  extensionManagementApi: ExtensionManagementApi.IExtensionManagementApi,
  extensionName: string
) {
  let documentId: string =
    packageMetadata.package_name +
    packageMetadata.package_version_number.replace(".", "_");
  packageMetadata.id = documentId;

  for (let i = 0; i < 5; i++) {
    try {
      let response = await extensionManagementApi.setDocumentByName(
        packageMetadata,
        PUBLISHER_NAME,
        extensionName,
        SCOPE_TYPE,
        SCOPE_VALUE,
        "sfpowerscripts_source_packages"
      );
      tl.debug(
        "Updated package details to extension storage" +
          JSON.stringify(response)
      );
      break;
    } catch (error) {
      tl.debug("Unable to update,Retrying" + error);
    }
  }
}

async function getExtensionName(
  extensionManagementApi: ExtensionManagementApi.IExtensionManagementApi
): Promise<string> {
  console.log("Checking for the version of sfpowerscripts");
  let extensionName;
  if (
    await extensionManagementApi.getInstalledExtensionByName(
      PUBLISHER_NAME,
      "sfpowerscripts-dev"
    )
  ) {
    extensionName = "sfpowerscripts-dev";
  } else if (
    await extensionManagementApi.getInstalledExtensionByName(
      PUBLISHER_NAME,
      "sfpowerscripts-review"
    )
  ) {
    extensionName = "sfpowerscripts-review";
  } else if (
    await extensionManagementApi.getInstalledExtensionByName(
      PUBLISHER_NAME,
      "sfpowerscripts-alpha"
    )
  ) {
    extensionName = "sfpowerscripts-alpha";
  } else if (
    await extensionManagementApi.getInstalledExtensionByName(
      PUBLISHER_NAME,
      "sfpowerscripts-beta"
    )
  ) {
    extensionName = "sfpowerscripts-beta";
  } else if (
    await extensionManagementApi.getInstalledExtensionByName(
      PUBLISHER_NAME,
      "sfpowerscripts"
    )
  ) {
    extensionName = "sfpowerscripts";
  }

  console.log(`Found Sfpowerscripts version ${extensionName}`);
  return extensionName;
}

run();
