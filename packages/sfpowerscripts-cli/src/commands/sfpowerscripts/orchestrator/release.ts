import { flags } from '@salesforce/command';
import SfpowerscriptsCommand from '../../../SfpowerscriptsCommand';
import { Messages } from '@salesforce/core';
import SFPStatsSender from "@dxatscale/sfpowerscripts.core/lib/utils/SFPStatsSender";
import ReleaseImpl from "../../../impl/release/ReleaseImpl";
import ReleaseDefinition from "../../../impl/release/ReleaseDefinition";
import path = require("path");

Messages.importMessagesDirectory(__dirname);
const messages = Messages.loadMessages('@dxatscale/sfpowerscripts', 'release');

export default class Release extends SfpowerscriptsCommand {

  public static description = messages.getMessage('commandDescription');

  public static examples = [
    `sfdx sfpowerscripts:orchestrator:release -p path/to/releasedefinition.yml -u myorg --npm --scope myscope`
  ];

  protected static requiresUsername = false;
  protected static requiresDevhubUsername = false;
  protected static requiresProject = false;

  protected static flagsConfig = {
    releasedefinition: flags.filepath({
      char: "p",
      description: messages.getMessage('releaseDefinitionFlagDescription')
    }),
    targetorg: flags.string({
      char: "u",
      description: messages.getMessage("targetOrgFlagDescription"),
      default: "scratchorg",
      required: true
    }),
    scriptpath: flags.filepath({
      char: 'f',
      description: messages.getMessage('scriptPathFlagDescription')
    }),
    npm: flags.boolean({
      description: messages.getMessage('npmFlagDescription'),
      exclusive: ['scriptpath']
    }),
    scope: flags.string({
      description: messages.getMessage('scopeFlagDescription'),
      dependsOn: ['npm'],
      parse: (scope) => scope.replace(/@/g,"").toLowerCase()
    }),
    npmrcpath: flags.filepath({
      description: messages.getMessage('npmrcPathFlagDescription'),
      dependsOn: ['npm'],
      required: false
    }),
    logsgroupsymbol: flags.array({
      char: "g",
      description: messages.getMessage("logsGroupSymbolFlagDescription")
    }),
    tag: flags.string({
      char: 't',
      description: messages.getMessage('tagFlagDescription')
    }),
    dryrun: flags.boolean({
      description: messages.getMessage("dryRunFlagDescription"),
      default: false,
      hidden: true
    }),
    waittime: flags.number({
      description: messages.getMessage("waitTimeFlagDescription"),
      default: 120
    }),
    keys: flags.string({
      required: false,
      description: messages.getMessage("keysFlagDescription")
    }),
    allowunpromotedpackages: flags.boolean({
      description: messages.getMessage("allowUnpromotedPackagesFlagDescription"),
      hidden: true
    })
  };


  public async execute(){
    this.validateFlags();

    let executionStartTime = Date.now();

    let tags = {
      targetOrg: this.flags.targetorg
    };

    if (this.flags.tag != null) {
      tags["tag"] = this.flags.tag;
    }

    let releaseDefinition = new ReleaseDefinition(
      this.flags.releasedefinition,
      this.flags.npm
    ).releaseDefinition;

    console.log("-----------sfpowerscripts orchestrator ------------------");
    console.log("command: release");
    console.log(`Target Org: ${this.flags.targetorg}`);
    console.log(`Release Definition: ${this.flags.releasedefinition}`);
    console.log(`Artifact Directory: ${path.resolve("artifacts")}`);
    console.log(`Skip Packages If Already Installed: ${releaseDefinition.releaseOptions?.skipIfAlreadyInstalled ? true : false}`);
    if(releaseDefinition.releaseOptions?.baselineOrg)
      console.log(`Baselined Against Org: ${releaseDefinition.releaseOptions.baselineOrg}`);
    console.log(`Dry-run: ${this.flags.dryrun}`);
    console.log("---------------------------------------------------------");

    let releaseResult: boolean;
    try {
      let releaseImpl: ReleaseImpl = new ReleaseImpl(
        releaseDefinition,
        this.flags.targetorg,
        this.flags.scriptpath,
        this.flags.npm,
        this.flags.scope,
        this.flags.npmrcpath,
        this.flags.logsgroupsymbol,
        tags,
        this.flags.dryrun,
        this.flags.waittime,
        this.flags.keys,
        !this.flags.allowunpromotedpackages
      );

      releaseResult = await releaseImpl.exec();

      if (releaseResult)
        process.exitCode = 0;
      else
        process.exitCode = 1;

    } catch (err) {
      releaseResult = false;
      console.log(err.message);

      // Fail the task when an error occurs
      process.exitCode = 1;
    } finally {
      let totalElapsedTime: number = Date.now() - executionStartTime;

      SFPStatsSender.logCount("release.scheduled",tags);

      if (releaseResult) {
        SFPStatsSender.logCount(
          "release.succeeded",
          tags
        );
      } else {
        SFPStatsSender.logCount(
          "release.failed",
          tags
        );
      }

      SFPStatsSender.logGauge(
        "release.duration",
        totalElapsedTime,
        tags
      );
    }
  }

  protected validateFlags() {
    if (this.flags.npm && !this.flags.scope)
      throw new Error("--scope parameter is required for NPM");
  }
}
