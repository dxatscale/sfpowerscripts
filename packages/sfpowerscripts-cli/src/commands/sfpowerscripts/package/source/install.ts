import { Messages } from "@salesforce/core";
import { flags } from "@salesforce/command";

import InstallPackageCommand from "../../../../InstallPackageCommand";
import InstallSourcePackageImpl from "@dxatscale/sfpowerscripts.core/lib/package/packageInstallers/InstallSourcePackageImpl"
import * as fs from "fs-extra"
import { PackageInstallationStatus } from "@dxatscale/sfpowerscripts.core/lib/package/packageInstallers/PackageInstallationResult";
import { ConsoleLogger } from "@dxatscale/sfpowerscripts.core/lib/logger/SFPLogger";
import { DeploymentType } from "@dxatscale/sfpowerscripts.core/lib/sfpcommands/source/DeploymentExecutor"


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
    `$ sfdx sfpowerscripts:package:source:install -n mypackage -u <org>`,
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
    skipifalreadyinstalled: flags.boolean({
      description: messages.getMessage("skipIfAlreadyInstalled"),
    }),
    skiponmissingartifact: flags.boolean({
      char: "s",
      description: messages.getMessage("skipOnMissingArtifactFlagDescription"),
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
    refname: flags.string({
      description: messages.getMessage('refNameFlagDescription')
    }),
    loglevel: flags.enum({
      description: "logging level for this command invocation",
      default: "info",
      required: false,
      options: [
        "trace",
        "debug",
        "info",
        "warn",
        "error",
        "fatal",
        "TRACE",
        "DEBUG",
        "INFO",
        "WARN",
        "ERROR",
        "FATAL",
      ],
    })
  };

  public async install(): Promise<any> {
    const target_org: string = this.flags.targetorg;
    const sfdx_package: string = this.flags.package;
    const optimizeDeployment: boolean = this.flags.optimizedeployment;
    const skipTesting: boolean = this.flags.skiptesting;
    const wait_time: string = this.flags.waittime;
    const skipIfAlreadyInstalled = this.flags.skipifalreadyinstalled;

    console.log("sfpowerscripts.Install Source Package To Org");

    try {
      let artifactMetadataFilepath = this.artifactFilePaths
        .packageMetadataFilePath;

      let packageMetadata = JSON.parse(
        fs.readFileSync(artifactMetadataFilepath).toString()
      );

      console.log("Package Metadata:");
      console.log(packageMetadata);

      let sourceDirectory: string = this.artifactFilePaths.sourceDirectoryPath;

      let options = {
        optimizeDeployment: optimizeDeployment,
        skipTesting: skipTesting,
        waitTime: wait_time
      };

      let installSourcePackageImpl: InstallSourcePackageImpl = new InstallSourcePackageImpl(
        sfdx_package,
        target_org,
        sourceDirectory,
        options,
        skipIfAlreadyInstalled,
        packageMetadata,
        new ConsoleLogger(),
        null,
        DeploymentType.MDAPI_DEPLOY,
        false

      );

      let result = await installSourcePackageImpl.exec();

      if (result.result == PackageInstallationStatus.Failed) {
        throw new Error(result.message);
      } else {
        console.log(`Succesfully Installed source package  ${sfdx_package}`);

        console.log("\n\nOutput variables:");
        if (result.deploy_id) {
          if (this.flags.refname) {
            fs.writeFileSync(
              ".env",
              `${this.flags.refname}_sfpowerscripts_installsourcepackage_deployment_id=${result.deploy_id}\n`,
              { flag: "a" }
            );
            console.log(`${this.flags.refname}_sfpowerscripts_installsourcepackage_deployment_id=${result.deploy_id}`);
          } else {
            fs.writeFileSync(
              ".env",
              `sfpowerscripts_installsourcepackage_deployment_id=${result.deploy_id}\n`,
              { flag: "a" }
            );
            console.log(`sfpowerscripts_installsourcepackage_deployment_id=${result.deploy_id}`);
          }
        }
      }
    } catch (error) {
      console.log(error.message);
      process.exitCode = 1;
    }
  }
}
