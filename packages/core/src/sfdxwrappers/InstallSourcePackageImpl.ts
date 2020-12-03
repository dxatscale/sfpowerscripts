import DeploySourceToOrgImpl from "./DeploySourceToOrgImpl";
import ReconcileProfileAgainstOrgImpl from "./ReconcileProfileAgainstOrgImpl";
import DeployDestructiveManifestToOrgImpl from "./DeployDestructiveManifestToOrgImpl";
import DeploySourceResult from "./DeploySourceResult";
import PackageMetadata from "../PackageMetadata";
import ManifestHelpers from "../manifest/ManifestHelpers";
import OrgDetails from "../org/OrgDetails";
import SFPStatsSender from "../utils/SFPStatsSender";
import {
  PackageInstallationResult,
  PackageInstallationStatus,
} from "../package/PackageInstallationResult";
import SFPLogger from "../utils/SFPLogger";

import ArtifactInstallationStatusChecker from "../artifacts/ArtifactInstallationStatusChecker";
import AssignPermissionSetsImpl from "./AssignPermissionSetsImpl";

const fs = require("fs-extra");
const path = require("path");
const glob = require("glob");
const os = require("os");
const { EOL } = require("os");
const tmp = require("tmp");

export default class InstallSourcePackageImpl {
  public constructor(
    private sfdx_package: string,
    private targetusername: string,
    private sourceDirectory: string,
    private subdirectory: string,
    private options: any,
    private wait_time: string,
    private skip_if_package_installed: boolean,
    private packageMetadata: PackageMetadata,
    private isPackageCheckHandledByCaller?: boolean
  ) {}

  public async exec(): Promise<PackageInstallationResult> {
    let isPackageInstalled = false;
    if (this.skip_if_package_installed) {
      isPackageInstalled = await ArtifactInstallationStatusChecker.checkWhetherPackageIsIntalledInOrg(
        this.targetusername,
        this.packageMetadata,
        this.subdirectory,
        this.isPackageCheckHandledByCaller
      );
      if (isPackageInstalled) {
        console.log("Skipping Package Installation");
        return { result: PackageInstallationStatus.Skipped };
      }
    }

    let tmpDirObj = tmp.dirSync({ unsafeCleanup: true });
    let tempDir = tmpDirObj.name;

    try {
      let startTime = Date.now();
      this.packageMetadata.isTriggerAllTests = this.isAllTestsToBeTriggered(
        this.packageMetadata
      );
      let packageDirectory: string = this.getPackageDirectory();

      // Apply Destructive Manifest
      if (this.packageMetadata.isDestructiveChangesFound) {
        await this.applyDestructiveChanges();
      }

      //Apply Reconcile if Profiles are found
      //To Reconcile we have to go for multiple deploys, first we have to reconcile profiles and deploy the metadata
      let isReconcileActivated = false,
        isReconcileErrored = false;
      let profileFolders;
      if (
        this.packageMetadata.isProfilesFound &&
        this.packageMetadata.preDeploymentSteps?.includes("reconcile")
      ) {
        ({
          profileFolders,
          isReconcileActivated,
          isReconcileErrored,
        } = await this.reconcileProfilesBeforeDeployment(
          profileFolders,
          this.sourceDirectory,
          this.targetusername,
          tempDir
        ));

        //Reconcile Failed, Bring back the original profiles
        if (isReconcileErrored && profileFolders.length > 0) {
          console.log("Restoring original profiles as preprocessing failed");
          profileFolders.forEach((folder) => {
            fs.copySync(
              path.join(tempDir, folder),
              path.join(this.sourceDirectory, folder)
            );
          });
        }
      }

      //Construct Deploy Command for actual payload
      let deploymentOptions = await this.generateDeploymentOptions(
        this.packageMetadata,
        this.wait_time,
        this.options.optimizeDeployment,
        this.options.skipTesting,
        this.targetusername
      );

      let deploySourceToOrgImpl: DeploySourceToOrgImpl = new DeploySourceToOrgImpl(
        this.targetusername,
        this.sourceDirectory,
        packageDirectory,
        deploymentOptions,
        false
      );

      let result: DeploySourceResult = await deploySourceToOrgImpl.exec();

      if (result.result && !result.message.startsWith("skip:")) {
        //Apply PostDeployment Activities
        try {
          if (isReconcileActivated) {
            //Bring back the original profiles, reconcile and redeploy again
            await this.reconcileAndRedeployProfiles(
              profileFolders,
              this.sourceDirectory,
              this.targetusername,
              packageDirectory,
              this.wait_time,
              this.options.skipTesting,
              tempDir
            );
          }

          await ArtifactInstallationStatusChecker.updatePackageInstalledInOrg(
            this.targetusername,
            this.packageMetadata,
            this.subdirectory,
            this.isPackageCheckHandledByCaller
          );


        } catch (error) {
          console.log(
            "Failed to apply reconcile the second time, Partial Metadata applied"
          );
        }

        this.applyPermsets();

        await ArtifactInstallationStatusChecker.updatePackageInstalledInOrg(
          this.targetusername,
          this.packageMetadata,
          this.subdirectory,
          this.isPackageCheckHandledByCaller
        );
      } else if (result.result === false) {
        throw new Error("Deployment failed with error " + result.message);
      }
      let elapsedTime = Date.now() - startTime;

      SFPStatsSender.logElapsedTime(
        "package.installation.elapsed_time",
        elapsedTime,
        {
          package: this.sfdx_package,
          type: "source",
          target_org: this.targetusername,
        }
      );
      SFPStatsSender.logCount("package.installation", {
        package: this.sfdx_package,
        type: "source",
        target_org: this.targetusername,
      });

      return {
        result: PackageInstallationStatus.Succeeded,
        deploy_id: result.deploy_id,
      };
    } catch (error) {
      console.log(error);
      SFPStatsSender.logCount("package.installation.failure", {
        package: this.sfdx_package,
        type: "source",
        target_org: this.targetusername,
      });
      return {
        result: PackageInstallationStatus.Failed,
        message: error,
      };
    } finally {
      // Cleanup temp directories
      tmpDirObj.removeCallback();
    }
  }

  private applyPermsets() {
    try {
      if (
        new RegExp("AssignPermissionSets", "i").test(
          this.packageMetadata.postDeploymentSteps?.toString()
        ) &&
        this.packageMetadata.permissionSetsToAssign
      ) {
        let assignPermissionSetsImpl: AssignPermissionSetsImpl = new AssignPermissionSetsImpl(
          this.targetusername,
          this.packageMetadata.permissionSetsToAssign,
          this.sourceDirectory
        );

        console.log("Executing post-deployment step: AssignPermissionSets");
        assignPermissionSetsImpl.exec();
      }
    } catch (error) {
      console.log("Unable to apply permsets, skipping");
    }
  }

  private async applyDestructiveChanges() {
    try {
      console.log(
        "Attempt to delete components mentioned in destructive manifest"
      );
      let deployDestructiveManifestToOrg = new DeployDestructiveManifestToOrgImpl(
        this.targetusername,
        path.join(this.sourceDirectory, "destructive", "destructiveChanges.xml")
      );

      await deployDestructiveManifestToOrg.exec();
    } catch (error) {
      console.log(
        "We attempted a deletion of components, However were are not succesfull. Either the components are already deleted or there are components which have dependency to components in the manifest, Please check whether this manifest works!"
      );
    }
  }

  private getPackageDirectory() {
    let packageDescriptor;
    if (this.sfdx_package) {
      packageDescriptor = ManifestHelpers.getSFDXPackageDescriptor(
        this.sourceDirectory,
        this.sfdx_package
      );
    } else {
      packageDescriptor = ManifestHelpers.getDefaultSFDXPackageDescriptor(
        this.sourceDirectory
      );
    }

    let packageDirectory: string;
    if (this.subdirectory) {
      packageDirectory = path.join(
        packageDescriptor["path"],
        this.subdirectory
      );
    } else {
      packageDirectory = path.join(packageDescriptor["path"]);
    }

    let absPackageDirectory: string = path.join(
      this.sourceDirectory,
      packageDirectory
    );
    if (!fs.existsSync(absPackageDirectory)) {
      throw new Error(`Source directory ${absPackageDirectory} does not exist`);
    }
    return packageDirectory;
  }

  private isAllTestsToBeTriggered(packageMetadata: PackageMetadata) {
    if (packageMetadata.package_type == "delta") {
      SFPLogger.log(
        ` ----------------------------------WARNING!  NON OPTIMAL DEPLOYMENT---------------------------------------------${EOL}` +
          `This package has apex classes/triggers, In order to deploy optimally, each class need to have a minimum ${EOL}` +
          `75% test coverage, However being a dynamically generated delta package, we will deploying via triggering all local tests${EOL}` +
          `This definitely is not optimal approach on large orgs, You might want to start splitting into smaller source/unlocked packages  ${EOL}` +
          `-------------------------------------------------------------------------------------------------------------`
      );
      return true;
    } else if (
      this.packageMetadata.package_type == "source" &&
      this.packageMetadata.isApexFound == true &&
      this.packageMetadata.apexTestClassses == null
    ) {
      SFPLogger.log(
        ` ----------------------------------WARNING!  NON OPTIMAL DEPLOYMENT--------------------------------------------${EOL}` +
          `This package has apex classes/triggers, In order to deploy optimally, each class need to have a minimum ${EOL}` +
          `75% test coverage,We are unable to find any test classes in the given package, hence will be deploying ${EOL}` +
          `via triggering all local tests,This definitely is not optimal approach on large orgs` +
          `Please consider adding test classes for the classes in the package ${EOL}` +
          `-------------------------------------------------------------------------------------------------------------`
      );
      return true;
    } else return false;
  }

  private async reconcileProfilesBeforeDeployment(
    profileFolders: any,
    sourceDirectoryPath: string,
    target_org: string,
    tempDir: string
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
            path.join(tempDir, folder)
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

  private async reconcileAndRedeployProfiles(
    profileFolders: string[],
    sourceDirectoryPath: string,
    target_org: string,
    sourceDirectory: string,
    wait_time: string,
    skipTest: boolean,
    tmpdir: string
  ) {
    if (profileFolders.length > 0) {
      profileFolders.forEach((folder) => {
        fs.copySync(
          path.join(tmpdir, folder),
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
        console.log("Unable to deploy reconciled  profiles");
      }
    }
  }

  private async generateDeploymentOptions(
    packageMetadata: PackageMetadata,
    wait_time: string,
    optimizeDeployment: boolean,
    skipTest: boolean,
    target_org: string
  ): Promise<any> {
    let mdapi_options = {};
    mdapi_options["ignore_warnings"] = true;
    mdapi_options["wait_time"] = wait_time;
    mdapi_options["checkonly"] = false;

    if (skipTest) {
      let result;
      try {
        result = await OrgDetails.getOrgDetails(target_org);
      } catch (err) {
        SFPLogger.log(
          ` -------------------------WARNING! SKIPPING TESTS AS ORG TYPE CANNOT BE DETERMINED! ------------------------------------${EOL}` +
            `Tests are mandatory for deployments to production and cannot be skipped. This deployment might fail as org${EOL}` +
            `type cannot be determined` +
            `-------------------------------------------------------------------------------------------------------------${EOL}`
        );

        mdapi_options["testlevel"] = "NoTestRun";
        return mdapi_options;
      }

      if (result && result["IsSandbox"]) {
        SFPLogger.log(
          ` --------------------------------------WARNING! SKIPPING TESTS-------------------------------------------------${EOL}` +
            `Skipping tests for deployment to sandbox. Be cautious that deployments to prod will require tests and >75% code coverage ${EOL}` +
            `-------------------------------------------------------------------------------------------------------------`
        );
        mdapi_options["testlevel"] = "NoTestRun";
      } else {
        SFPLogger.log(
          ` -------------------------WARNING! TESTS ARE MANDATORY FOR PROD DEPLOYMENTS------------------------------------${EOL}` +
            `Tests are mandatory for deployments to production and cannot be skipped. Running all local tests! ${EOL}` +
            `-------------------------------------------------------------------------------------------------------------`
        );
        mdapi_options["testlevel"] = "RunLocalTests";
      }
    } else if (this.packageMetadata.isApexFound) {
      if (this.packageMetadata.isTriggerAllTests) {
        mdapi_options["testlevel"] = "RunLocalTests";
      } else if (
        this.packageMetadata.apexTestClassses?.length > 0 &&
        optimizeDeployment
      ) {
        mdapi_options["testlevel"] = "RunSpecifiedTests";
        mdapi_options["specified_tests"] = this.getAStringOfSpecificTestClasses(
          this.packageMetadata.apexTestClassses
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

  private getAStringOfSpecificTestClasses(apexTestClassses: string[]) {
    const doublequote = '"';
    let specifedTests = doublequote + apexTestClassses.join(",") + doublequote;
    return specifedTests;
  }
}
