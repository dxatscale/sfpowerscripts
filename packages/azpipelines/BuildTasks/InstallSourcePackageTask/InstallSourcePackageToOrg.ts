import tl = require("azure-pipelines-task-lib/task");
import { isNullOrUndefined } from "util";
import DeploySourceToOrgImpl from "@dxatscale/sfpowerscripts.core/lib/sfdxwrappers/DeploySourceToOrgImpl";
import ReconcileProfileAgainstOrgImpl from "@dxatscale/sfpowerscripts.core/lib/sfdxwrappers/ReconcileProfileAgainstOrgImpl";
import DeployDestructiveManifestToOrgImpl from "@dxatscale/sfpowerscripts.core/lib/sfdxwrappers/DeployDestructiveManifestToOrgImpl";
import DeploySourceResult from "@dxatscale/sfpowerscripts.core/lib/sfdxwrappers/DeploySourceResult";
import PackageMetadata from "@dxatscale/sfpowerscripts.core/lib/PackageMetadata";
import * as ExtensionManagementApi from "azure-devops-node-api/ExtensionManagementApi";
import { getWebAPIWithoutToken } from "../Common/WebAPIHelper";
import ArtifactFilePathFetcher from "@dxatscale/sfpowerscripts.core/lib/artifacts/ArtifactFilePathFetcher";
import SFPStatsSender from "@dxatscale/sfpowerscripts.core/lib/utils/SFPStatsSender"
import ManifestHelpers from "@dxatscale/sfpowerscripts.core/lib/manifest/ManifestHelpers";
import {
  getExtensionName,
  fetchPackageArtifactFromStorage,
  updatePackageDeploymentDetails,
} from "../Common/PackageExtensionStorageHelper";
import ArtifactHelper from "../Common/ArtifactHelper";
import OrgDetails from "@dxatscale/sfpowerscripts.core/lib/org/OrgDetails"
const fs = require("fs-extra");
const path = require("path");
const glob = require("glob");
const os = require("os");
const { EOL } = require("os");

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
   SFPStatsSender.initialize(tl.getVariable("SFPOWERSCRIPTS_STATSD_PORT"),tl.getVariable("SFPOWERSCRIPTS_STATSD_HOST"),tl.getVariable("SFPOWERSCRIPTS_STATSD_PROTOCOL"));


     //Intialize Time
     let startTime=Date.now();

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

    if (packageMetadataFromStorage.package_type == "delta") {
      console.log(
        ` ----------------------------------WARNING!  NON OPTIMAL DEPLOYMENT---------------------------------------------${EOL}` +
          `This package has apex classes/triggers, In order to deploy optimally, each class need to have a minimum ${EOL}` +
          `75% test coverage, However being a dynamically generated delta package, we will deploying via triggering all local tests${EOL}` +
          `This definitely is not optimal approach on large orgs, You might want to start splitting into smaller source/unlocked packages  ${EOL}` +
          `-------------------------------------------------------------------------------------------------------------`
      );
      packageMetadataFromStorage.isTriggerAllTests = true;
    } else if (
      packageMetadataFromStorage.package_type == "source" &&
      packageMetadataFromStorage.isApexFound == true &&
      packageMetadataFromStorage.apexTestClassses == null
    ) {
      console.log(
        ` ----------------------------------WARNING!  NON OPTIMAL DEPLOYMENT--------------------------------------------${EOL}` +
          `This package has apex classes/triggers, In order to deploy optimally, each class need to have a minimum ${EOL}` +
          `75% test coverage,We are unable to find any test classes in the given package, hence will be deploying ${EOL}` +
          `via triggering all local tests,This definitely is not optimal approach on large orgs` +
          `Please consider adding test classes for the classes in the package ${EOL}` +
          `-------------------------------------------------------------------------------------------------------------`
      );
      packageMetadataFromStorage.isTriggerAllTests = true;
    }

    let sourceDirectory;
    // Get package source directory from sfdx-project.json in sourceDirectoryPath
    if (!isNullOrUndefined(sfdx_package)) {
      sourceDirectory = ManifestHelpers.getSFDXPackageDescriptor(
        artifacts_filepaths[0].sourceDirectoryPath,
        sfdx_package
      )["path"];
    } else {
      console.log(
        "##[warning] No Package name passed in the input parameter, Utilizing the default package in the manifest"
      );
      sourceDirectory = ManifestHelpers.getDefaultSFDXPackageDescriptor(
        artifacts_filepaths[0].sourceDirectoryPath
      )["path"];
    }

    console.log("Path for the project", sourceDirectory);
    if (!isNullOrUndefined(subdirectory)) {
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

    // Apply Destructive Manifest
    if (packageMetadataFromStorage.isDestructiveChangesFound) {
      try {
        console.log(
          "Attempt to delete components mentioned in destructive manifest"
        );
        let deployDestructiveManifestToOrg = new DeployDestructiveManifestToOrgImpl(
          target_org,
          path.join(
            artifacts_filepaths[0].sourceDirectoryPath,
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
    let isReconcileActivated = false,
      isReconcileErrored = false;
    let profileFolders;
    if (
      packageMetadataFromStorage.isProfilesFound &&
      packageMetadataFromStorage.preDeploymentSteps?.includes("reconcile")
    ) {
      ({
        profileFolders,
        isReconcileActivated,
        isReconcileErrored,
      } = await reconcileProfilesBeforeDeployment(
        profileFolders,
        artifacts_filepaths[0].sourceDirectoryPath,
        target_org
      ));

      //Reconcile Failed, Bring back the original profiles
       if (isReconcileErrored && profileFolders.length > 0) {
       console.log("Restoring original profiles as preprocessing failed");
        profileFolders.forEach((folder) => {
          fs.copySync(
            path.join(tl.getVariable("agent.tempDirectory"), folder),
            path.join(artifacts_filepaths[0].sourceDirectoryPath, folder)
          );
        });
      }
    }

    
    //Construct Deploy Command for actual payload
    let deploymentOptions = await generateDeploymentOptions(
      packageMetadataFromStorage,
      wait_time,
      optimizeDeployment,
      skipTesting,
      target_org
    );


    let deploySourceToOrgImpl: DeploySourceToOrgImpl = new DeploySourceToOrgImpl(
      target_org,
      artifacts_filepaths[0].sourceDirectoryPath,
      sourceDirectory,
      deploymentOptions,
      false
    );

    let result: DeploySourceResult = await deploySourceToOrgImpl.exec();

    if (!isNullOrUndefined(result.deploy_id)) {
      tl.setVariable("sfpowerscripts_deploysource_id", result.deploy_id);
    }


    if (result.result && !result.message.startsWith("skip:")) {
      console.log("Applying Post Deployment Activites");
      //Apply PostDeployment Activities
      try {
        if (isReconcileActivated) {
          //Bring back the original profiles, reconcile and redeploy again
          await reconcileAndRedeployProfiles(
            profileFolders,
            artifacts_filepaths[0].sourceDirectoryPath,
            target_org,
            sourceDirectory,
            wait_time,
            skipTesting
          );
        }
      } catch (error) {
        tl.warning(
          "Failed to apply reconcile the second time, Partial Metadata applied"
        );
      }


      
      //Calculate Elapsed Time
      let elapsedTime=Date.now()-startTime;


      
     SFPStatsSender.logElapsedTime("package.installation.elapsed_time",elapsedTime,{package:sfdx_package,type:"source", target_org:target_org});
     SFPStatsSender.logCount("package.installation",{package:sfdx_package,type:"source",target_org:target_org});


      //No environment info available, create and push
      if (isNullOrUndefined(packageMetadataFromStorage.deployments)) {
        packageMetadataFromStorage.deployments = new Array();
        packageMetadataFromStorage.deployments.push({
          target_org: target_org,
          sub_directory: subdirectory,
          timestamp:Date.now(),
          installation_time:elapsedTime
        });
      } else if(result.result && result.message.startsWith("skip:"))
      {
        tl.setResult(tl.TaskResult.Skipped, result.message);
      }
      else {
        //Update existing environment map
        packageMetadataFromStorage.deployments.push({
          target_org: target_org,
          sub_directory: subdirectory,
          timestamp:Date.now(),
          installation_time:elapsedTime
        });
      }

      await updatePackageDeploymentDetails(
        packageMetadataFromStorage,
        extensionManagementApi,
        extensionName
      );
      tl.setResult(tl.TaskResult.Succeeded, result.message);
    }    
    else {
      tl.error(result.message);
      tl.setResult(
        tl.TaskResult.Failed,
        `Validation/Deployment with Job ID ${result.deploy_id} failed`
      );
    }
  } catch (err) {
    tl.setResult(tl.TaskResult.Failed, err.message);
    SFPStatsSender.logCount("package.installation.failure",{package:tl.getInput("package",false),type:"source"})
  }
}

async function reconcileProfilesBeforeDeployment(
  profileFolders: any,
  sourceDirectoryPath: string,
  target_org: string
) {
  let isReconcileActivated: boolean = false;
  let isReconcileErrored: boolean = false;
  try {
    console.log("Attempting reconcile to profiles");
    //copy the original profiles to temporary location
    profileFolders = glob.sync("**/profiles", {
      cwd: path.join(sourceDirectoryPath),
    });
    if (profileFolders.length > 0) {
      profileFolders.forEach((folder) => {
        fs.copySync(
          path.join(sourceDirectoryPath, folder),
          path.join(tl.getVariable("agent.tempDirectory"), folder)
        );
      });
    }
    //Now Reconcile
    let reconcileProfileAgainstOrg: ReconcileProfileAgainstOrgImpl = new ReconcileProfileAgainstOrgImpl(
      target_org,
      path.join(sourceDirectoryPath)
    );
    await reconcileProfileAgainstOrg.exec();
    isReconcileActivated = true;
  } catch (err) {
    console.log("Failed to reconcile profiles:" + err);
    isReconcileErrored = true;
  }
  return { profileFolders, isReconcileActivated, isReconcileErrored };
}

async function reconcileAndRedeployProfiles(
  profileFolders: string[],
  sourceDirectoryPath: string,
  target_org: string,
  sourceDirectory: string,
  wait_time: string,
  skipTest:boolean
) {
  if (profileFolders.length > 0) {
    profileFolders.forEach((folder) => {
      fs.copySync(
        path.join(tl.getVariable("agent.tempDirectory"), folder),
        path.join(sourceDirectoryPath, folder)
      );
    });

    //Now Reconcile
    let reconcileProfileAgainstOrg: ReconcileProfileAgainstOrgImpl = new ReconcileProfileAgainstOrgImpl(
      target_org,
      path.join(sourceDirectoryPath)
    );
    await reconcileProfileAgainstOrg.exec();

    //Now deploy the profies alone
    fs.appendFileSync(
      path.join(sourceDirectoryPath, ".forceignore"),
      "**.**" + os.EOL
    );
    fs.appendFileSync(
      path.join(sourceDirectoryPath, ".forceignore"),
      "!**.profile-meta.xml"
    );

    let deploymentOptions = {};
    deploymentOptions["ignore_warnings"] = true;
    deploymentOptions["wait_time"] = wait_time;

    if (skipTest) {
      deploymentOptions["testlevel"] = "NoTestRun";
    } else {
      deploymentOptions["testlevel"] = "RunSpecifiedTests";
      deploymentOptions["specified_tests"] = "skip";
    }

    let deploySourceToOrgImpl: DeploySourceToOrgImpl = new DeploySourceToOrgImpl(
      target_org,
      sourceDirectoryPath,
      sourceDirectory,
      deploymentOptions,
      false
    );
    let profileReconcile: DeploySourceResult = await deploySourceToOrgImpl.exec();

    if (!profileReconcile.result) {
      tl.warning("Unable to deploy reconciled  profiles");
    }
  }
}

async function generateDeploymentOptions(
  packageMetadata: PackageMetadata,
  wait_time: string,
  optimizeDeployment: boolean,
  skipTest:boolean,
  target_org: string
): Promise<any> {
  let mdapi_options = {};
  mdapi_options["ignore_warnings"] = true;
  mdapi_options["wait_time"] = wait_time;

  if (skipTest) {
    let result;
    try {
      result = await OrgDetails.getOrgDetails(target_org);
    } catch(err) {
      console.log("Unable determine type of org...Defaulting to production");
      console.log(
        ` -------------------------WARNING! TESTS ARE MANDATORY FOR PROD DEPLOYMENTS------------------------------------${EOL}` +
          `Tests are mandatory for deployments to production and cannot be skipped. Running all local tests! ${EOL}` +
          `-------------------------------------------------------------------------------------------------------------`
      );
      mdapi_options["testlevel"] = "RunLocalTests";
    }

    if (result["IsSandbox"]) {
      console.log(
        ` --------------------------------------WARNING! SKIPPING TESTS-------------------------------------------------${EOL}` +
          `Skipping tests for deployment to sandbox. Be cautious that deployments to prod will require tests and >75% code coverage ${EOL}` +
          `-------------------------------------------------------------------------------------------------------------`
      );
      mdapi_options["testlevel"] = "NoTestRun";
    } else {
      console.log(
        ` -------------------------WARNING! TESTS ARE MANDATORY FOR PROD DEPLOYMENTS------------------------------------${EOL}` +
          `Tests are mandatory for deployments to production and cannot be skipped. Running all local tests! ${EOL}` +
          `-------------------------------------------------------------------------------------------------------------`
      );
      mdapi_options["testlevel"] = "RunLocalTests";
    }

  } else if (packageMetadata.isApexFound) {
     if(packageMetadata.isTriggerAllTests)
     {
      mdapi_options["testlevel"] = "RunLocalTests";
     }
     else if (packageMetadata.apexTestClassses?.length>0 && optimizeDeployment) {
      mdapi_options["testlevel"] = "RunSpecifiedTests";
      mdapi_options["specified_tests"] = getAStringOfSpecificTestClasses(
        packageMetadata.apexTestClassses
      );
    } else {
      mdapi_options["testlevel"] = "RunLocalTests";
    }
  } else {
    mdapi_options["testlevel"] = "RunSpecifiedTests";
    mdapi_options["specified_tests"] = "skip";
  }
  return mdapi_options;
}

function getAStringOfSpecificTestClasses(apexTestClassses: string[]) {
  const doublequote = '"';
  let specifedTests = doublequote + apexTestClassses.join(",") + doublequote;
  return specifedTests;
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
