import tl = require("azure-pipelines-task-lib/task");
import * as ExtensionManagementApi from "azure-devops-node-api/ExtensionManagementApi";

const PUBLISHER_NAME = "AzlamSalam";
const SCOPE_TYPE = "Default";
const SCOPE_VALUE = "Current";

export async function fetchPackageArtifactFromStorage(
  packageMetadata: any,
  extensionManagementApi: ExtensionManagementApi.IExtensionManagementApi,
  extensionName: string
): Promise<any> {
  try {
    let documentId: string =
      packageMetadata.package_name +
      packageMetadata.package_version_number.replace(".", "_");

    let response: any = await extensionManagementApi.getDocumentByName(
      PUBLISHER_NAME,
      extensionName,
      SCOPE_TYPE,
      SCOPE_VALUE,
      "sfpowerscripts_packages",
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

export async function updatePackageDeploymentDetails(
  packageMetadata: any,
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
        "sfpowerscripts_packages"
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

export async function getExtensionName(
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

  console.log(`Found sfpowerscripts version ${extensionName}`);
  return extensionName;
}
