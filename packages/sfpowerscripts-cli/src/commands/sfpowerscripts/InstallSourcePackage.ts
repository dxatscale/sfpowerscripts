import { Messages } from "@salesforce/core";
import { flags } from "@salesforce/command";


import InstallPackageCommand from "../../InstallPackageCommand";
import InstallSourcePackageImpl from "@dxatscale/sfpowerscripts.core/lib/sfdxwrappers/InstallSourcePackageImpl"

const fs = require("fs-extra");
const path = require("path");

// Initialize Messages with the current plugin directory
Messages.importMessagesDirectory(__dirname);

// Load the specific messages for this file. Messages from @salesforce/command, @salesforce/core,
// or any library that is using the messages framework can also be loaded this way.
const messages = Messages.loadMessages(
  "@dxatscale/sfpowerscripts",
  "install_source_package"
);

export default class InstallSourcePackage extends InstallPackageCommand {
  public static description = messages.getMessage("commandDescription");

  public static examples = [
    `$ sfdx sfpowerscripts:InstallSourcePackage -n mypackage -u <org>`,
  ];

  protected static flagsConfig = {
    package: flags.string({
      char: "n",
      description: messages.getMessage("packageFlagDescription"),
      required: true,
    }),
    targetorg: flags.string({
      char: "u",
      description: messages.getMessage("targetOrgFlagDescription"),
      required: true,
    }),
    artifactdir: flags.directory({
      description: messages.getMessage("artifactDirectoryFlagDescription"),
      default: "artifacts",
    }),
    skipifalreadyinstalled: flags.boolean({description: messages.getMessage("skipIfAlreadyInstalled")}),
    skiponmissingartifact: flags.boolean({
      char: "s",
      description: messages.getMessage("skipOnMissingArtifactFlagDescription"),
    }),
    subdirectory: flags.directory({
      description: messages.getMessage("subdirectoryFlagDescription"),
    }),
    optimizedeployment: flags.boolean({
      char: "o",
      description: messages.getMessage("optimizedeployment"),
      default: false,
      required: false,
    }),
    skiptesting: flags.boolean({
      char: "t",
      description: messages.getMessage("skiptesting"),
      default: false,
      required: false,
    }),
    waittime: flags.string({
      description: messages.getMessage("waitTimeFlagDescription"),
      default: "120",
    }),
  };

  public async install(): Promise<any> {
    const target_org: string = this.flags.targetorg;
    const sfdx_package: string = this.flags.package;
    const artifact_directory: string = this.flags.artifactdir;
    const subdirectory: string = this.flags.subdirectory;
    const skip_on_missing_artifact: boolean = this.flags.skiponmissingartifact;
    const optimizeDeployment: boolean = this.flags.optimizedeployment;
    const skipTesting: boolean = this.flags.skiptesting;
    const wait_time: string = this.flags.waittime;
    const skipIfAlreadyInstalled = this.flags.skipifalreadyinstalled;



  
    console.log("sfpowerscripts.Install Source Package To Org");

    try {
      let artifactMetadataFilepath = path.join(
        artifact_directory,
        `${sfdx_package}_sfpowerscripts_artifact`,
        `artifact_metadata.json`
      );

      console.log(
        `Checking for ${sfdx_package} Build Artifact at path ${artifactMetadataFilepath}`
      );

      if (
        !fs.existsSync(artifactMetadataFilepath) &&
        !skip_on_missing_artifact
      ) {
        throw new Error(
          `Artifact not found at ${artifactMetadataFilepath}.. Please check the inputs`
        );
      } else if (
        !fs.existsSync(artifactMetadataFilepath) &&
        skip_on_missing_artifact
      ) {
        console.log(
          `Skipping task as artifact is missing, and 'SkipOnMissingArtifact' ${skip_on_missing_artifact}`
        );
        process.exitCode = 0;
        return;
      }

      let packageMetadata = JSON.parse(
        fs.readFileSync(artifactMetadataFilepath).toString()
      );

      console.log("Package Metadata:");
      console.log(packageMetadata);

      let sourceDirectory: string = path.join(
        artifact_directory,
        `${sfdx_package}_sfpowerscripts_artifact`,
        `source`
      );


      let options = {
        optimizeDeployment : optimizeDeployment,
        skipTesting:skipTesting
      };


      let installSourcePackageImpl: InstallSourcePackageImpl = new InstallSourcePackageImpl(
        sfdx_package,
        target_org,
        sourceDirectory,
        subdirectory,
        options,
        wait_time,
        skipIfAlreadyInstalled,
        packageMetadata
      )

      await installSourcePackageImpl.exec();


    } catch (error) {
      console.log(error);
      process.exitCode=1;
    }
  }
}
