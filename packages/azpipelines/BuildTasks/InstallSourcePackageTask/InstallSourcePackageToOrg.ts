import tl = require("azure-pipelines-task-lib/task");
import { isNullOrUndefined } from "util";
import DeploySourceToOrgImpl from "@dxatscale/sfpowerscripts.core/lib/sfdxwrappers/DeploySourceToOrgImpl";
import ReconcileProfileAgainstOrgImpl from "@dxatscale/sfpowerscripts.core/lib/sfdxwrappers/ReconcileProfileAgainstOrgImpl";
import DeployDestructiveManifestToOrgImpl from "@dxatscale/sfpowerscripts.core/lib/sfdxwrappers/DeployDestructiveManifestToOrgImpl";
import DeploySourceResult from "@dxatscale/sfpowerscripts.core/lib/sfdxwrappers/DeploySourceResult";
import OrgDetails from "@dxatscale/sfpowerscripts.core/lib/org/OrgDetails";
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

const fs = require("fs-extra");
const path = require("path");
const glob = require("glob");
const os = require("os");

async function run() {
  try {
    console.log("sfpowerscripts.Install Source Package To Org");

    const target_org: string = tl.getInput("target_org", true);
    const sfdx_package: string = tl.getInput("package", false);
    const package_installedfrom = tl.getInput("packageinstalledfrom", true);
    const artifactDir = tl.getInput("artifactDir", false);
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
    let artifactFilePaths = ArtifactFilePathFetcher.fetchArtifactFilePaths(
      ArtifactHelper.getArtifactDirectory(artifactDir),
      sfdx_package
    );
    console.log("##[debug]Artifact Paths", JSON.stringify(artifactFilePaths));
    ArtifactFilePathFetcher.missingArtifactDecider(
      artifactFilePaths[0].packageMetadataFilePath,
      skip_on_missing_artifact
    );
    let isToBeSkipped=ArtifactFilePathFetcher.missingArtifactDecider(
      artifactFilePaths[0].packageMetadataFilePath,
      skip_on_missing_artifact
    );
    ArtifactHelper.skipTaskWhenArtifactIsMissing(isToBeSkipped);

    let packageMetadataFromArtifact: PackageMetadata = JSON.parse(
      fs.readFileSync(artifactFilePaths[0].packageMetadataFilePath, "utf8")
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

    let sourceDirectory;
    if (!isNullOrUndefined(sfdx_package)) {
      sourceDirectory = ManifestHelpers.getSFDXPackageDescriptor(
        artifactFilePaths[0].sourceDirectoryPath,
        sfdx_package
      )["path"];
    } else {
      console.log(
        "##[warning] No Package name passed in the input parameter, Utilizing the default package in the manifest"
      );
      sourceDirectory = ManifestHelpers.getDefaultSFDXPackageDescriptor(
        artifactFilePaths[0].sourceDirectoryPath
      )["path"];
    }

    console.log("Path for the project", sourceDirectory);
    if (!isNullOrUndefined(subdirectory)) {
      sourceDirectory = path.join(sourceDirectory, subdirectory);
    }

    // Apply Destructive Manifest
    if (
      upgrade_type == "ApplyDestructiveChanges" &&
      packageMetadataFromStorage.isDestructiveChangesFound
    ) {
      try {
        console.log(
          "Attempt to delete components mentioned in destructive manifest"
        );
        let deployDestructiveManifestToOrg = new DeployDestructiveManifestToOrgImpl(
          target_org,
          path.join(
            artifactFilePaths[0].sourceDirectoryPath,
            "destructive",
            "destructiveChanges.xml"
          )
        );

        deployDestructiveManifestToOrg.exec();
      } catch (error) {
        tl.logIssue(
          tl.IssueType.Warning,
          "We attempted a deletion of components, However were are not succesfull. Either the components are already deleted or there are components which have dependency to components in the manifest, Please check whether this manifest works!"
        );
      }
    }

    //Apply Reconcile if Profiles are found
    //To Reconcile we have to go for multiple deploys, first we have to reconcile profiles and deploy the metadata
    let isReconcileActivated = false,isReconcileErrored=false;
    let profileFolders;
    if (
      packageMetadataFromStorage.isProfilesFound &&
      packageMetadataFromStorage.preDeploymentSteps?.includes("reconcile")
    ) {
      try {
        console.log("Attempting reconcile to profiles");
        //copy the original profiles to temporary location
        profileFolders = glob.sync("**/profiles", {
          cwd: path.join(artifactFilePaths[0].sourceDirectoryPath),
        });
        if (profileFolders.length > 0) {
          profileFolders.forEach((folder) => {
            fs.copySync(path.join(artifactFilePaths[0].sourceDirectoryPath,folder), path.join(tl.getVariable("agent.tempDirectory"), folder));
          });
        }
        //Now Reconcile
        let reconcileProfileAgainstOrg: ReconcileProfileAgainstOrgImpl = new ReconcileProfileAgainstOrgImpl(
          target_org,
          path.join(artifactFilePaths[0].sourceDirectoryPath)
        );
        await reconcileProfileAgainstOrg.exec();
        isReconcileActivated = true;
      } catch (err) {
        console.log("Failed to reconcile profiles:"+err);
        isReconcileErrored=true;
      }
    }

    //Reconcile Failed, Bring back the original profiles
    console.log("Restoring original profiles as preprocessing failed");
    if(isReconcileErrored && profileFolders.length>0)
    {
      profileFolders.forEach((folder) => {
        fs.copySync(
          path.join(tl.getVariable("agent.tempDirectory"), folder),
          path.join(artifactFilePaths[0].sourceDirectoryPath, folder)
        );
      });
    }


    //Construct Deploy Command
    let deploymentOptions = await generateDeploymentOptions(
      wait_time,
      packageMetadataFromStorage.apextestsuite,
      target_org
    );
    let deploySourceToOrgImpl: DeploySourceToOrgImpl = new DeploySourceToOrgImpl(
      target_org,
      artifactFilePaths[0].sourceDirectoryPath,
      sourceDirectory,
      deploymentOptions,
      false
    );

    let result: DeploySourceResult = await deploySourceToOrgImpl.exec();

    if (!isNullOrUndefined(result.deploy_id)) {
      tl.setVariable("sfpowerscripts_deploysource_id", result.deploy_id);
    }

    if (result.result) {

      console.log("Applying Post Deployment Activites")
      //Apply PostDeployment Activities
      try {
        if (isReconcileActivated) {
          //Bring back the original profiles
          if (profileFolders.length > 0) {
            profileFolders.forEach((folder) => {
              fs.copySync(
                path.join(tl.getVariable("agent.tempDirectory"), folder),
                path.join(artifactFilePaths[0].sourceDirectoryPath, folder)
              );
            });


            //Now Reconcile
            let reconcileProfileAgainstOrg: ReconcileProfileAgainstOrgImpl = new ReconcileProfileAgainstOrgImpl(
              target_org,
              path.join(artifactFilePaths[0].sourceDirectoryPath)
            );
            await reconcileProfileAgainstOrg.exec();
            isReconcileActivated = true;

            //Now deploy the profies alone
            fs.appendFileSync(
              path.join(artifactFilePaths[0].sourceDirectoryPath, ".forceignore"),
              "**.**" + os.EOL
            );
            fs.appendFileSync(
              path.join(artifactFilePaths[0].sourceDirectoryPath, ".forceignore"),
              "!**.profile-meta.xml"
            );

            let deploySourceToOrgImpl: DeploySourceToOrgImpl = new DeploySourceToOrgImpl(
              target_org,
              artifactFilePaths[0].sourceDirectoryPath,
              sourceDirectory,
              deploymentOptions,
              false
            );
            let profileReconcile: DeploySourceResult = await deploySourceToOrgImpl.exec();

            if (!profileReconcile.result) {
              tl.warning("Unable to deploy profiles");
            }
          }
        }
      } catch (error) {
        tl.warning(
          "Failed to apply reconcile the second time, Partial Metadata applied"
        );
      }



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

async function generateDeploymentOptions(
  wait_time: string,
  apextextsuite: string,
  target_org: string
): Promise<any> {
  let mdapi_options = {};
  mdapi_options["ignore_warnings"] = true;
  mdapi_options["wait_time"] = wait_time;

  if (!isNullOrUndefined(apextextsuite)) {
    mdapi_options["testlevel"] = "RunApexTestSuite";
    mdapi_options["apextestsuite"] = apextextsuite;
  } else {
    //Determine test option
    try {
      let result = await OrgDetails.getOrgDetails(target_org);
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
