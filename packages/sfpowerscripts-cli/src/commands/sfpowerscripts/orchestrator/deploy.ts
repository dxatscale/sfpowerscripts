import { flags } from "@salesforce/command";
import SfpowerscriptsCommand from "../../../SfpowerscriptsCommand";
import { Messages } from "@salesforce/core";
import SFPStatsSender from "@dxatscale/sfpowerscripts.core/lib/utils/SFPStatsSender";
import DeployImpl, { DeploymentMode } from "../../../impl/deploy/DeployImpl";


// Initialize Messages with the current plugin directory
Messages.importMessagesDirectory(__dirname);

// Load the specific messages for this file. Messages from @salesforce/command, @salesforce/core,
// or any library that is using the messages framework can also be loaded this way.
const messages = Messages.loadMessages("@dxatscale/sfpowerscripts", "deploy");

export default class Deploy extends SfpowerscriptsCommand {
  public static description = messages.getMessage("commandDescription");

  public static examples = [
    `$ sfdx sfpowerscripts:orchestrator:deploy -u <username>`
  ];

  protected static requiresUsername = false;
  protected static requiresDevhubUsername = false;
  protected static requiresProject = true;

  protected static flagsConfig = {
    targetorg: flags.string({
      char: "u",
      description: messages.getMessage("targetOrgFlagDescription"),
      default: "scratchorg",
      required: true
    }),
    artifactdir: flags.directory({
      description: messages.getMessage("artifactDirectoryFlagDescription"),
      default: "artifacts",
    }),
    waittime: flags.string({
      description: messages.getMessage("waitTimeFlagDescription"),
      default: "120",
    }),
    logsgroupsymbol: flags.array({
      char: "g",
      description: messages.getMessage("logsGroupSymbolFlagDescription")
    }),
    tag: flags.string({
      char: 't',
      description: messages.getMessage('tagFlagDescription')
    }),
    skipifalreadyinstalled: flags.boolean({
      required:false,
      default:true,
      description: messages.getMessage("skipIfAlreadyInstalled"),
    }),
  };

  public async execute() {
    let executionStartTime = Date.now();

    console.log("-----------sfpowerscripts orchestrator ------------------");
    console.log("command: deploy");
    console.log(`Skip Packages If Already Installed: ${this.flags.skipifalreadyinstalled}`);
    console.log(`Is Dependencies to be validated (unlocked): ${this.flags.isvalidationtobeskipped}`);
    console.log(`Config File Path: ${this.flags.configfilepath}`);
    console.log(`Artifact Directory: ${this.flags.artifactdir}`);
    console.log("---------------------------------------------------------");




    let deploymentResult: {deployed: string[], skipped: string[], failed: string[]};

    let tags = {
      targetOrg: this.flags.targetorg
    };

    if (this.flags.tag != null) {
      tags["tag"] = this.flags.tag;
    }

    try {
      let deployImpl: DeployImpl = new DeployImpl(
        this.flags.targetorg,
        this.flags.artifactdir,
        this.flags.waittime,
        tags,
      );

      deployImpl.activateApexUnitTests(false);
      deployImpl.setDeploymentMode(DeploymentMode.NORMAL)
      deployImpl.skipIfPackageExistsInTheOrg(this.flags.skipifalreadyinstalled);
      deployImpl.setLogSymbols(this.flags.logsgroupsymbol);

      deploymentResult = await deployImpl.exec();

      if (deploymentResult.failed.length > 0) {
        process.exitCode = 1;
      }
    } catch (error) {
      console.log(error);
      process.exitCode = 1;
    } finally {
      let totalElapsedTime: number = Date.now() - executionStartTime;

      if (this.flags.logsgroupsymbol?.[0])
        console.log(this.flags.logsgroupsymbol[0], "Deployment Summary");

      console.log(
        `----------------------------------------------------------------------------------------------------`
      );
      console.log(
        `${deploymentResult.deployed.length} packages deployed in ${this.getFormattedTime(
          totalElapsedTime
        )} with {${deploymentResult.failed.length}} errors and {${deploymentResult.skipped.length}} skipped`
      );


      if (deploymentResult.skipped.length > 0) {
        console.log(`\nPackages Skipped`, deploymentResult.skipped);
      }

      if (deploymentResult.failed.length > 0) {
        console.log(`\nPackages Failed to Deploy`, deploymentResult.failed);
      }
      console.log(
        `----------------------------------------------------------------------------------------------------`
      );

      SFPStatsSender.logGauge(
        "deploy.duration",
        totalElapsedTime,
        tags
      );

      SFPStatsSender.logGauge(
        "deploy.succeeded",
        deploymentResult.deployed.length,
        tags
      );

      if (deploymentResult.skipped.length > 0) {
        SFPStatsSender.logGauge(
          "deploy.skipped",
          deploymentResult.skipped.length,
          tags
        );
      }

      if (deploymentResult.failed.length > 0) {
        SFPStatsSender.logGauge(
          "deploy.failed",
          deploymentResult.failed.length,
          tags
        );
      }
    }
  }

  private getFormattedTime(milliseconds: number): string {
    let date = new Date(0);
    date.setSeconds(milliseconds / 1000); // specify value for SECONDS here
    let timeString = date.toISOString().substr(11, 8);
    return timeString;
  }
}
