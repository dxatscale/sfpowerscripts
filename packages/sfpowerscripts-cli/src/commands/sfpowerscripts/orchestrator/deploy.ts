import { flags } from "@salesforce/command";
import SfpowerscriptsCommand from "../../../SfpowerscriptsCommand";
import { Messages } from "@salesforce/core";
import SFPStatsSender from "@dxatscale/sfpowerscripts.core/lib/stats/SFPStatsSender";
import DeployImpl, { DeploymentMode, DeployProps } from "../../../impl/deploy/DeployImpl";
import { Stage } from "../../../impl/Stage";
import { COLOR_ERROR, COLOR_HEADER,COLOR_SUCCESS } from "@dxatscale/sfpowerscripts.core/lib/logger/SFPLogger"


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
  protected static requiresProject = false;

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
    waittime: flags.number({
      description: messages.getMessage("waitTimeFlagDescription"),
      default: 120,
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
      default:false,
      description: messages.getMessage("skipIfAlreadyInstalled"),
    }),
    baselineorg: flags.string({
      char: "b",
      description: messages.getMessage("baselineorgFlagDescription"),
      required: false,
      dependsOn: ['skipifalreadyinstalled']
    }),
    allowunpromotedpackages: flags.boolean({
      description: messages.getMessage("allowUnpromotedPackagesFlagDescription"),
      deprecated: {messageOverride:"--allowunpromotedpackages is deprecated, All packages are allowed"},
      hidden: true
    }),
    retryonfailure:flags.boolean({
      description: messages.getMessage('retryOnFailureFlagDescription'),
      hidden:true
    })
  };

  public async execute() {
    let executionStartTime = Date.now();

    console.log(COLOR_HEADER("-----------sfpowerscripts orchestrator ------------------"));
    console.log(COLOR_HEADER("command: deploy"));
    console.log(COLOR_HEADER(`Skip Packages If Already Installed: ${this.flags.skipifalreadyinstalled}`));
    console.log(COLOR_HEADER(`Artifact Directory: ${this.flags.artifactdir}`));
    if(this.flags.baselineorg)
      console.log(COLOR_HEADER(`Baselined Against Org: ${this.flags.baselineorg}`))
    console.log(COLOR_HEADER("---------------------------------------------------------"));




    let deploymentResult: {
      deployed: string[],
      failed: string[],
      error: any
    };

    let tags = {
      targetOrg: this.flags.targetorg
    };

    if (this.flags.tag != null) {
      tags["tag"] = this.flags.tag;
    }


    let deployProps:DeployProps = {
      targetUsername:this.flags.targetorg,
      artifactDir:this.flags.artifactdir,
      waitTime:this.flags.waittime,
      tags:tags,
      isTestsToBeTriggered:false,
      deploymentMode:DeploymentMode.NORMAL,
      skipIfPackageInstalled:this.flags.skipifalreadyinstalled,
      logsGroupSymbol:this.flags.logsgroupsymbol,
      currentStage:Stage.DEPLOY,
      baselineOrg: this.flags.baselineorg,
      isRetryOnFailure:this.flags.retryonfailure
    }

    try {
      let deployImpl: DeployImpl = new DeployImpl(
        deployProps
      );

      deploymentResult = await deployImpl.exec();

      if (deploymentResult.failed.length > 0 || deploymentResult.error) {
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
      console.log(COLOR_SUCCESS(
        `${deploymentResult.deployed.length} packages deployed in ${this.getFormattedTime(
          totalElapsedTime
        )} with {${deploymentResult.failed.length}} errors`)
      );



      if (deploymentResult.failed.length > 0) {
        console.log(COLOR_ERROR(`\nPackages Failed to Deploy`, deploymentResult.failed));
      }
      console.log(
        `----------------------------------------------------------------------------------------------------`
      );

      if (this.flags.logsgroupsymbol?.[1])
        console.log(this.flags.logsgroupsymbol[1]);

     SFPStatsSender.logCount("deploy.scheduled",tags);

      SFPStatsSender.logGauge(
        "deploy.duration",
        totalElapsedTime,
        tags
      );


      SFPStatsSender.logGauge(
        "deploy.succeeded.packages",
        deploymentResult.deployed.length,
        tags
      );

      SFPStatsSender.logGauge(
        "deploy.failed.packages",
        deploymentResult.failed.length,
        tags
      );

      if (deploymentResult.failed.length > 0) {

        SFPStatsSender.logCount(
          "deploy.failed",
          tags
        );
      }
      else
      {
        SFPStatsSender.logCount(
          "deploy.succeeded",
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
