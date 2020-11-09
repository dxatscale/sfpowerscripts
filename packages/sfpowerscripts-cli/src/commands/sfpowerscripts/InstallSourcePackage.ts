
import { isNullOrUndefined } from "util";
import DeploySourceToOrgImpl from "@dxatscale/sfpowerscripts.core/lib/sfdxwrappers/DeploySourceToOrgImpl";
import ReconcileProfileAgainstOrgImpl from "@dxatscale/sfpowerscripts.core/lib/sfdxwrappers/ReconcileProfileAgainstOrgImpl";
import DeployDestructiveManifestToOrgImpl from "@dxatscale/sfpowerscripts.core/lib/sfdxwrappers/DeployDestructiveManifestToOrgImpl";
import DeploySourceResult from "@dxatscale/sfpowerscripts.core/lib/sfdxwrappers/DeploySourceResult";
import PackageMetadata from "@dxatscale/sfpowerscripts.core/lib/PackageMetadata";
import ManifestHelpers from "@dxatscale/sfpowerscripts.core/lib/manifest/ManifestHelpers";
import OrgDetails from "@dxatscale/sfpowerscripts.core/lib/org/OrgDetails"
import { Messages } from "@salesforce/core";
import SfpowerscriptsCommand from "../../SfpowerscriptsCommand";
import { flags } from "@salesforce/command";
import SFPStatsSender from "@dxatscale/sfpowerscripts.core/lib/utils/SFPStatsSender";
const fs = require("fs-extra");
const path = require("path");
const glob = require("glob");
const os = require("os");
const { EOL } = require("os");
const tmp = require('tmp');

// Initialize Messages with the current plugin directory
Messages.importMessagesDirectory(__dirname);

// Load the specific messages for this file. Messages from @salesforce/command, @salesforce/core,
// or any library that is using the messages framework can also be loaded this way.
const messages = Messages.loadMessages('@dxatscale/sfpowerscripts', 'install_source_package');

export default class InstallSourcePackage extends SfpowerscriptsCommand {
 

  public static description = messages.getMessage('commandDescription');

  public static examples = [
    `$ sfdx sfpowerscripts:InstallSourcePackage -n mypackage -u <org>`
  ];


  protected static flagsConfig = {
    package: flags.string({char: 'n', description: messages.getMessage('packageFlagDescription'), required: true}),
    targetorg: flags.string({char: 'u', description: messages.getMessage('targetOrgFlagDescription'), required: true}),
    artifactdir: flags.directory({description: messages.getMessage('artifactDirectoryFlagDescription'), default: 'artifacts'}),
    skiponmissingartifact: flags.boolean({char: 's', description: messages.getMessage('skipOnMissingArtifactFlagDescription')}),
    subdirectory: flags.directory({description: messages.getMessage('subdirectoryFlagDescription')}),
    optimizedeployment: flags.boolean({char:'o',description: messages.getMessage('optimizedeployment'),default:false,required:false}),
    skiptesting: flags.boolean({char:'t',description: messages.getMessage('skiptesting'),default:false,required:false}),
    waittime: flags.string({description: messages.getMessage('waitTimeFlagDescription'), default: '120'}),
    
  };


  public async execute(): Promise<any> {
    
    const target_org: string = this.flags.targetorg;
    const sfdx_package: string =this.flags.package;
    const artifact_directory: string = this.flags.artifactdir;
    const subdirectory: string = this.flags.subdirectory;
    const skip_on_missing_artifact: boolean = this.flags.skiponmissingartifact;
    const optimizeDeployment: boolean=this.flags.optimizedeployment;
    const skipTesting: boolean=this.flags.skiptesting; ;
    const wait_time: string = this.flags.waittime;


    let tmpDirObj = tmp.dirSync({unsafeCleanup: true});
    let tempDir = tmpDirObj.name;
   
    let startTime=Date.now();
    console.log("sfpowerscripts.Install Source Package To Org");

    try
    {

    let artifactMetadataFilepath = path.join(
          artifact_directory,
          `${sfdx_package}_sfpowerscripts_artifact`,
          `artifact_metadata.json`
      );

      console.log(`Checking for ${sfdx_package} Build Artifact at path ${artifactMetadataFilepath}`);

      if (!fs.existsSync(artifactMetadataFilepath) && !skip_on_missing_artifact) {
          throw new Error(
          `Artifact not found at ${artifactMetadataFilepath}.. Please check the inputs`
          );
      } else if(!fs.existsSync(artifactMetadataFilepath) && skip_on_missing_artifact) {
          console.log(`Skipping task as artifact is missing, and 'SkipOnMissingArtifact' ${skip_on_missing_artifact}`);
          process.exit(0);
      }

      let packageMetadata = JSON.parse(fs
      .readFileSync(artifactMetadataFilepath)
      .toString());

      console.log("Package Metadata:");
      console.log(packageMetadata);


      if (packageMetadata.package_type == "delta") {
        console.log(
          ` ----------------------------------WARNING!  NON OPTIMAL DEPLOYMENT---------------------------------------------${EOL}` +
            `This package has apex classes/triggers, In order to deploy optimally, each class need to have a minimum ${EOL}` +
            `75% test coverage, However being a dynamically generated delta package, we will deploying via triggering all local tests${EOL}` +
            `This definitely is not optimal approach on large orgs, You might want to start splitting into smaller source/unlocked packages  ${EOL}` +
            `-------------------------------------------------------------------------------------------------------------`
        );
        packageMetadata.isTriggerAllTests = true;
      } else if (
        packageMetadata.package_type == "source" &&
        packageMetadata.isApexFound == true &&
        packageMetadata.apexTestClassses == null
      ) {
        console.log(
          ` ----------------------------------WARNING!  NON OPTIMAL DEPLOYMENT--------------------------------------------${EOL}` +
            `This package has apex classes/triggers, In order to deploy optimally, each class need to have a minimum ${EOL}` +
            `75% test coverage,We are unable to find any test classes in the given package, hence will be deploying ${EOL}` +
            `via triggering all local tests,This definitely is not optimal approach on large orgs` +
            `Please consider adding test classes for the classes in the package ${EOL}` +
            `-------------------------------------------------------------------------------------------------------------`
        );
        packageMetadata.isTriggerAllTests = true;
      }


      let sourceDirectory: string = path.join(
        artifact_directory,
        `${sfdx_package}_sfpowerscripts_artifact`,
        `source`
      )

      let packageDescriptor = ManifestHelpers.getSFDXPackageDescriptor(sourceDirectory, sfdx_package);


      let packageDirectory: string;
      if (subdirectory) {
        packageDirectory = path.join(
          packageDescriptor["path"],
          subdirectory
        );
      } else {
        packageDirectory = path.join(
          packageDescriptor["path"]
        )
      }

      let absPackageDirectory: string = path.join(sourceDirectory, packageDirectory);
      if (!fs.existsSync(absPackageDirectory)) {
        throw new Error(`Source directory ${absPackageDirectory} does not exist`)
      }



       // Apply Destructive Manifest
    if (packageMetadata.isDestructiveChangesFound) {
      try {
        console.log(
          "Attempt to delete components mentioned in destructive manifest"
        );
        let deployDestructiveManifestToOrg = new DeployDestructiveManifestToOrgImpl(
          target_org,
          path.join(
            sourceDirectory,
            "destructive",
            "destructiveChanges.xml"
          )
        );

        deployDestructiveManifestToOrg.exec();
      } catch (error) {
        console.log(
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
      packageMetadata.isProfilesFound &&
      packageMetadata.preDeploymentSteps?.includes("reconcile")
    ) {
      ({
        profileFolders,
        isReconcileActivated,
        isReconcileErrored,
      } = await this.reconcileProfilesBeforeDeployment(
        profileFolders,
        sourceDirectory,
        target_org,
        tempDir
      ));

      //Reconcile Failed, Bring back the original profiles
       if (isReconcileErrored && profileFolders.length > 0) {
       console.log("Restoring original profiles as preprocessing failed");
        profileFolders.forEach((folder) => {
          fs.copySync(
            path.join(tempDir, folder),
            path.join(sourceDirectory, folder)
          );
        });
      }
    }

    
    //Construct Deploy Command for actual payload
    let deploymentOptions = await this.generateDeploymentOptions(
      packageMetadata,
      wait_time,
      optimizeDeployment,
      skipTesting,
      target_org
    );


    let deploySourceToOrgImpl: DeploySourceToOrgImpl = new DeploySourceToOrgImpl(
      target_org,
      sourceDirectory,
      packageDirectory,
      deploymentOptions,
      false
    );

    let result: DeploySourceResult = await deploySourceToOrgImpl.exec();

    if (!isNullOrUndefined(result.deploy_id)) {
      if (!isNullOrUndefined(this.flags.refname)) {
        fs.writeFileSync('.env', `${this.flags.refname}_sfpowerkit_deploysource_id=${result.deploy_id}\n`, {flag:'a'});
      } else {
        fs.writeFileSync('.env', `sfpowerkit_deploysource_id=${result.deploy_id}\n`, {flag:'a'});
      }
    }


    if (result.result && !result.message.startsWith("skip:")) {
      console.log("Applying Post Deployment Activites");
      //Apply PostDeployment Activities
      try {
        if (isReconcileActivated) {
          //Bring back the original profiles, reconcile and redeploy again
          await this.reconcileAndRedeployProfiles(
            profileFolders,
            sourceDirectory,
            target_org,
            packageDirectory,
            wait_time,
            skipTesting,
            tempDir
          );
        }



      } catch (error) {
        console.log(
          "Failed to apply reconcile the second time, Partial Metadata applied"
        );
      }

  }
  let elapsedTime=Date.now()-startTime;
      
  SFPStatsSender.logElapsedTime("package.installation.elapsed_time",elapsedTime,{package:sfdx_package,type:"source", target_org:target_org})
  SFPStatsSender.logCount("package.installation",{package:sfdx_package,type:"source",target_org:target_org})
   
  }catch(error)
  {
    // Cleanup temp directories
    tmpDirObj.removeCallback();
    console.log(error);
    process.exitCode=1;
  }
  finally
  {
     // Cleanup temp directories
     tmpDirObj.removeCallback();
  }
}

  private async  reconcileProfilesBeforeDeployment(
    profileFolders: any,
    sourceDirectoryPath: string,
    target_org: string,
    tempDir:string
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
  
  private   async reconcileAndRedeployProfiles(
    profileFolders: string[],
    sourceDirectoryPath: string,
    target_org: string,
    sourceDirectory: string,
    wait_time: string,
    skipTest:boolean,
    tmpdir:string
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
  
  private async  generateDeploymentOptions(
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
        mdapi_options["specified_tests"] = this.getAStringOfSpecificTestClasses(
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
  
  private getAStringOfSpecificTestClasses(apexTestClassses: string[]) {
    const doublequote = '"';
    let specifedTests = doublequote + apexTestClassses.join(",") + doublequote;
    return specifedTests;
  }

}





   
   

   


    





