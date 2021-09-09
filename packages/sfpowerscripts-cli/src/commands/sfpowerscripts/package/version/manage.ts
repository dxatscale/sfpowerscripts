import { Messages } from "@salesforce/core";
import SfpowerscriptsCommand from '../../../../SfpowerscriptsCommand';
import { flags } from '@salesforce/command';
import fs = require("fs");
import VersionManageImpl from '/Users/caitlyn.mills/sfpowerscripts/sfpowerscripts/packages/sfpowerscripts-cli/src/impl/package/VersionManageImpl';


// Initialize Messages with the current plugin directory
Messages.importMessagesDirectory(__dirname);

// Load the specific messages for this file. Messages from @salesforce/command, @salesforce/core,
// or any library that is using the messages framework can also be loaded this way.
const messages = Messages.loadMessages('@dxatscale/sfpowerscripts', 'manage_versions');

export default class Manage extends SfpowerscriptsCommand {

  public static description = messages.getMessage('commandDescription');

  public static examples = [
    `sfdx sfpowerscripts:package:version:manage -a`,
    `sfdx sfpowerscripts:package:version:manage -p package-name -b -v major -n -d`,
    `sfdx sfpowerscripts:package:version:manage -allpackages --resetbuildnumber`,
    `sfdx sfpowerscripts:package:version:manage -p package-name`

  ];

  protected static flagsConfig = {
    dependents: flags.boolean({
      required: false,
      default: false,
      char: "d",
      description: messages.getMessage("dependenciesDescription"),
    }),
    package: flags.string({
      required: false,
      char: 'p',
      description: messages.getMessage('packageDescription')
    }),
    allpackages: flags.boolean({
      required: false,
      default: false,
      char: "a",
      description: messages.getMessage("allPackagesDescription"),
    }),
    version: flags.enum({
      required: false,
      char: "v",
      description: messages.getMessage("versionDescription"),
      options: [
        "major",
        "minor",
        "patch",
      ]
    }),
    noprompt: flags.boolean({
      required: false,
      default: false,
      char: 'n',
      description: "noPromptDescription"
    }),
    resetbuildnumber: flags.boolean({
      required: false,
      default: true,
      char: 'b',
      description: messages.getMessage("buildNumberDescription")
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

  protected static requiresProject = true;
  protected static requiresUsername = false;
  protected static requiresDevhubUsername = false;

  public async execute() {
    try {
      const projectConfig = JSON.parse(
        fs.readFileSync("sfdx-project.json", "utf8")
      );

      let versionManageImpl: VersionManageImpl = new VersionManageImpl(
        projectConfig, 
        this.flags.allpackages, 
        this.flags.dependents, 
        this.flags.package, 
        this.flags.version, 
        this.flags.noprompt, 
        this.flags.resetbuildnumber
      );

      versionManageImpl.execute();
    }
    catch (err) {
      console.log(err);
      process.exit(1);
    }
  }

}