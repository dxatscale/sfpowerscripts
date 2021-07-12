import DeploySourceToOrgImpl from "../source/DeploySourceToOrgImpl";
import PushSourceToOrgImpl from "../source/PushSourceToOrgImpl";
import DeploymentExecutor, {
  DeploySourceResult,
  DeploymentType,
} from "../../sfpcommands/source/DeploymentExecutor";
import ReconcileProfileAgainstOrgImpl from "../../sfpowerkitwrappers/ReconcileProfileAgainstOrgImpl";
import DeployDestructiveManifestToOrgImpl from "../../sfpowerkitwrappers/DeployDestructiveManifestToOrgImpl";
import PackageMetadata from "../../PackageMetadata";
import ProjectConfig from "../../project/ProjectConfig";
import OrgDetails from "../../org/OrgDetails";
import SFPStatsSender from "../../stats/SFPStatsSender";
import {
  PackageInstallationResult,
  PackageInstallationStatus,
} from "../../package/PackageInstallationResult";
import SFPLogger, { Logger, LoggerLevel } from "../../logger/SFPLogger";

import ArtifactInstallationStatusChecker from "../../artifacts/ArtifactInstallationStatusChecker";
import PackageInstallationHelpers from "./PackageInstallationHelpers";

import * as fs from "fs-extra";
import ArtifactInstallationStatusUpdater from "../../artifacts/ArtifactInstallationStatusUpdater";
import { AuthInfo, Connection } from "@salesforce/core";
import { convertAliasToUsername } from "../../utils/AliasList";
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
    private options: any,
    private wait_time: string,
    private skip_if_package_installed: boolean,
    private packageMetadata: PackageMetadata,
    private packageLogger?: Logger,
    private pathToReplacementForceIgnore?: string,
    private deploymentType?: DeploymentType
  ) {}

  public async exec(): Promise<PackageInstallationResult> {
    //Create a conncetion to the target org for api calls
    const connection: Connection = await Connection.create({
      authInfo: await AuthInfo.create({ username: convertAliasToUsername(this.targetusername) }),
    });

    let packageDescriptor;
    if (this.sfdx_package) {
      packageDescriptor = ProjectConfig.getSFDXPackageDescriptor(
        this.sourceDirectory,
        this.sfdx_package
      );
    } else {
      packageDescriptor = ProjectConfig.getDefaultSFDXPackageDescriptor(
        this.sourceDirectory
      );
    }

    let isPackageInstalled = false;
    if (this.skip_if_package_installed) {
      let installationStatus = await ArtifactInstallationStatusChecker.checkWhetherPackageIsIntalledInOrg(
        this.packageLogger,
        this.targetusername,
        this.packageMetadata
      );
      isPackageInstalled = installationStatus.isInstalled;
      if (isPackageInstalled) {
        SFPLogger.log(
          "Skipping Package Installation",
          LoggerLevel.INFO,
          this.packageLogger
        );
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
      let packageDirectory: string = this.getPackageDirectory(
        packageDescriptor
      );

      let preDeploymentScript: string = path.join(
        this.sourceDirectory,
        `scripts`,
        `preDeployment`
      );

      if (fs.existsSync(preDeploymentScript)) {
        SFPLogger.log(
          "Executing preDeployment script",
          LoggerLevel.INFO,
          this.packageLogger
        );
        await PackageInstallationHelpers.executeScript(
          preDeploymentScript,
          this.sfdx_package,
          this.targetusername,
          this.packageLogger
        );
      }

      if (this.pathToReplacementForceIgnore) {
        this.replaceForceIgnoreInSourceDirectory(
          this.sourceDirectory,
          this.pathToReplacementForceIgnore
        );
      }

      if (this.packageMetadata.assignPermSetsPreDeployment) {
        SFPLogger.log(
          "Assigning permission sets before deployment:",
          LoggerLevel.INFO,
          this.packageLogger
        );

        await PackageInstallationHelpers.applyPermsets(
          this.packageMetadata.assignPermSetsPreDeployment,
          connection,
          this.sourceDirectory,
          this.packageLogger
        );
      }

      // Apply Destructive Manifest
      if (this.packageMetadata.destructiveChanges) {
        await this.applyDestructiveChanges();
      }

      //Apply Reconcile if Profiles are found
      //To Reconcile we have to go for multiple deploys, first we have to reconcile profiles and deploy the metadata
      let isReconcileActivated = false,
        isReconcileErrored = false;
      let profileFolders;
      if (
        this.packageMetadata.isProfilesFound &&
        this.packageMetadata.reconcileProfiles !== false
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
          SFPLogger.log(
            "Restoring original profiles as preprocessing failed",
            LoggerLevel.INFO,
            this.packageLogger
          );
          profileFolders.forEach((folder) => {
            fs.copySync(
              path.join(tempDir, folder),
              path.join(this.sourceDirectory, folder)
            );
          });
        }
      }

      let result: DeploySourceResult;
      if (this.deploymentType === DeploymentType.SOURCE_PUSH) {
        let pushSourceToOrgImpl: DeploymentExecutor = new PushSourceToOrgImpl(
          this.targetusername,
          this.sourceDirectory
        );

        result = await pushSourceToOrgImpl.exec();
      } else {
        //Construct Deploy Command for actual payload
        let deploymentOptions = await this.generateDeploymentOptions(
          this.packageMetadata,
          this.wait_time,
          this.options.optimizeDeployment,
          this.options.skipTesting,
          this.targetusername
        );

        let deploySourceToOrgImpl: DeploymentExecutor = new DeploySourceToOrgImpl(
          this.targetusername,
          this.sourceDirectory,
          packageDirectory,
          deploymentOptions,
          false,
          this.packageLogger
        );

        result = await deploySourceToOrgImpl.exec();
      }

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
        } catch (error) {
          SFPLogger.log(
            "Failed to apply reconcile the second time, Partial Metadata applied",
            LoggerLevel.INFO,
            this.packageLogger
          );
        }

        await ArtifactInstallationStatusUpdater.updatePackageInstalledInOrg(
          this.packageLogger,
          this.targetusername,
          this.packageMetadata
        );
      } else if (result.result === false) {
        throw new Error(result.message);
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

      let postDeploymentScript: string = path.join(
        this.sourceDirectory,
        `scripts`,
        `postDeployment`
      );

      if (fs.existsSync(postDeploymentScript)) {
        console.log(
          "Executing postDeployment script",
          LoggerLevel.INFO,
          this.packageLogger
        );
        await PackageInstallationHelpers.executeScript(
          postDeploymentScript,
          this.sfdx_package,
          this.targetusername,
          this.packageLogger
        );
      }

      if (this.packageMetadata.assignPermSetsPostDeployment) {
        SFPLogger.log(
          "Assigning permission sets after deployment:",
          LoggerLevel.INFO,
          this.packageLogger
        );

        await PackageInstallationHelpers.applyPermsets(
          this.packageMetadata.assignPermSetsPostDeployment,
          connection,
          this.sourceDirectory,
          this.packageLogger
        );
      }

      return {
        result: PackageInstallationStatus.Succeeded,
        deploy_id: result.deploy_id,
      };
    } catch (error) {
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

  private async applyDestructiveChanges() {
    try {
      SFPLogger.log(
        "Attempt to delete components mentioned in destructive manifest",
        LoggerLevel.INFO,
        this.packageLogger
      );
      let deployDestructiveManifestToOrg = new DeployDestructiveManifestToOrgImpl(
        this.targetusername,
        path.join(this.sourceDirectory, "destructive", "destructiveChanges.xml")
      );

      await deployDestructiveManifestToOrg.exec();
    } catch (error) {
      SFPLogger.log(
        "We attempted a deletion of components, However were are not succesfull. Either the components are already deleted or there are components which have dependency to components in the manifest, Please check whether this manifest works!",
        LoggerLevel.INFO,
        this.packageLogger
      );
    }
  }

  private getPackageDirectory(packageDescriptor: any): string {
    let packageDirectory: string;

    if (packageDescriptor.aliasfy) {
      packageDirectory = path.join(
        packageDescriptor["path"],
        this.targetusername
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
          `-------------------------------------------------------------------------------------------------------------`,
        LoggerLevel.INFO,
        this.packageLogger
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
          `-------------------------------------------------------------------------------------------------------------`,
        LoggerLevel.INFO,
        this.packageLogger
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
      SFPLogger.log(
        "Attempting reconcile to profiles",
        LoggerLevel.INFO,
        this.packageLogger
      );
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
        path.join(sourceDirectoryPath),
        this.packageLogger
      );
      await reconcileProfileAgainstOrg.exec();
      isReconcileActivated = true;
    } catch (err) {
      SFPLogger.log(
        "Failed to reconcile profiles:" + err,
        LoggerLevel.INFO,
        this.packageLogger
      );
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
        path.join(sourceDirectoryPath),
        this.packageLogger
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
        false,
        this.packageLogger
      );
      let profileReconcile: DeploySourceResult = await deploySourceToOrgImpl.exec();

      if (!profileReconcile.result) {
        SFPLogger.log(
          "Unable to deploy reconciled  profiles",
          LoggerLevel.INFO,
          this.packageLogger
        );
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
        result = await OrgDetails.getOrgDetails(target_org, this.packageLogger);
      } catch (err) {
        SFPLogger.log(
          ` -------------------------WARNING! SKIPPING TESTS AS ORG TYPE CANNOT BE DETERMINED! ------------------------------------${EOL}` +
            `Tests are mandatory for deployments to production and cannot be skipped. This deployment might fail as org${EOL}` +
            `type cannot be determined` +
            `-------------------------------------------------------------------------------------------------------------${EOL}`,
          LoggerLevel.WARN,
          this.packageLogger
        );

        mdapi_options["testlevel"] = "NoTestRun";
        return mdapi_options;
      }

      if (result && result["IsSandbox"]) {
        SFPLogger.log(
          ` --------------------------------------WARNING! SKIPPING TESTS-------------------------------------------------${EOL}` +
            `Skipping tests for deployment to sandbox. Be cautious that deployments to prod will require tests and >75% code coverage ${EOL}` +
            `-------------------------------------------------------------------------------------------------------------`,
          LoggerLevel.DEBUG,
          this.packageLogger
        );
        mdapi_options["testlevel"] = "NoTestRun";
      } else {
        SFPLogger.log(
          ` -------------------------WARNING! TESTS ARE MANDATORY FOR PROD DEPLOYMENTS------------------------------------${EOL}` +
            `Tests are mandatory for deployments to production and cannot be skipped. Running all local tests! ${EOL}` +
            `-------------------------------------------------------------------------------------------------------------`,
          LoggerLevel.WARN,
          this.packageLogger
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

  /**
   * Replaces forceignore in source directory with provided forceignore
   * @param sourceDirectory
   * @param pathToReplacementForceIgnore
   */
  private replaceForceIgnoreInSourceDirectory(
    sourceDirectory: string,
    pathToReplacementForceIgnore: string
  ): void {
    if (fs.existsSync(pathToReplacementForceIgnore))
      fs.copySync(
        pathToReplacementForceIgnore,
        path.join(sourceDirectory, ".forceignore")
      );
    else {
      SFPLogger.log(
        `${pathToReplacementForceIgnore} does not exist`,
        LoggerLevel.INFO,
        this.packageLogger
      );
      SFPLogger.log(
        "Package installation will continue using the unchanged forceignore in the source directory",
        null,
        this.packageLogger
      );
    }
  }
}
