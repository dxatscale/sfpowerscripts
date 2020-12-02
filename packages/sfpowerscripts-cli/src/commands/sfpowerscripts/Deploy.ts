import { flags } from "@salesforce/command";
import SfpowerscriptsCommand from "../../SfpowerscriptsCommand";
import { Messages } from "@salesforce/core";
import fs = require("fs");
import SFPStatsSender from "@dxatscale/sfpowerscripts.core/lib/utils/SFPStatsSender";
import DeployImpl from "@dxatscale/sfpowerscripts.core/lib/deploy/DeployImpl";

// Initialize Messages with the current plugin directory
Messages.importMessagesDirectory(__dirname);

// Load the specific messages for this file. Messages from @salesforce/command, @salesforce/core,
// or any library that is using the messages framework can also be loaded this way.
const messages = Messages.loadMessages("@dxatscale/sfpowerscripts", "deploy");

export default class Deploy extends SfpowerscriptsCommand {
  public static description = messages.getMessage("commandDescription");

  public static examples = [
    `$ sfdx sfpowerscripts:Deploy -u <username>`
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
    validateclasscoveragefor: flags.array({
      char: "c",
      description: messages.getMessage("validateClassCoverageForFlagDescription")
    }),
    validatemode: flags.boolean({
      description: messages.getMessage("validateModeFlagDescription"),
      hidden: true,
      default: false,
    })
  };

  public async execute() {
    try {
      let deployImpl: DeployImpl = new DeployImpl(
        this.flags.targetorg,
        process.cwd(),
        this.flags.artifactdir,
        this.flags.waittime,
        this.flags.validateclasscoveragefor,
        this.flags.validatemode
      );

      await deployImpl.exec();

      console.log("Deployment complete");
    } catch (error) {
      console.log(error);
      process.exitCode=1;
    }
  }

}
