import { flags } from '@salesforce/command';
import SfpowerscriptsCommand from '../../../SfpowerscriptsCommand';
import { Messages } from '@salesforce/core';
import SFPStatsSender from "@dxatscale/sfpowerscripts.core/lib/stats/SFPStatsSender";
import ReleaseImpl, { ReleaseProps, ReleaseResult } from "../../../impl/release/ReleaseImpl";
import ReleaseDefinition from "../../../impl/release/ReleaseDefinition";
import ReleaseError from "../../../errors/ReleaseError";
import path = require("path");
import { COLOR_ERROR, COLOR_HEADER,COLOR_INFO,COLOR_TIME,COLOR_SUCCESS, COLOR_WARNING } from "@dxatscale/sfpowerscripts.core/lib/logger/SFPLogger"


Messages.importMessagesDirectory(__dirname);
const messages = Messages.loadMessages('@dxatscale/sfpowerscripts', 'release');

export default class Release extends SfpowerscriptsCommand {



  public static description = messages.getMessage('commandDescription');

  public static examples = [
    `sfdx sfpowerscripts:orchestrator:release -p path/to/releasedefinition.yml -u myorg --npm --scope myscope --generatechangelog`
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
    generatechangelog: flags.boolean({
      default: false,
      description: messages.getMessage("generateChangelogFlagDescription")
    }),
    branchname: flags.string({
      dependsOn: ['generatechangelog'],
      char: "b",
      description: messages.getMessage('branchNameFlagDescription')
    }),
    allowunpromotedpackages: flags.boolean({
      description: messages.getMessage("allowUnpromotedPackagesFlagDescription"),
      hidden: true,
      deprecated: {messageOverride:"--allowunpromotedpackages is deprecated, All packages are allowed"}
    }),
    devhubalias: flags.string({
      char: "v",
      description: messages.getMessage("devhubAliasFlagDescription"),
      default: "HubOrg",
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


  public async execute(){
    this.validateFlags();

    let tags = {
      targetOrg: this.flags.targetorg
    };

    if (this.flags.tag != null) {
      tags["tag"] = this.flags.tag;
    }

    let executionStartTime = Date.now();

    let releaseDefinition = new ReleaseDefinition(
      this.flags.releasedefinition
    ).releaseDefinition;

    if (this.flags.generatechangelog && !releaseDefinition.changelog)
      throw new Error("changelog parameters must be specified in release definition to generate changelog");

    console.log(COLOR_HEADER("-----------sfpowerscripts orchestrator ------------------"));
    console.log(COLOR_HEADER("command: release"));
    console.log(COLOR_HEADER(`Target Org: ${this.flags.targetorg}`));
    console.log(COLOR_HEADER(`Release Definition: ${this.flags.releasedefinition}`));
    console.log(COLOR_HEADER(`Artifact Directory: ${path.resolve("artifacts")}`));
    console.log(COLOR_HEADER(`Skip Packages If Already Installed: ${releaseDefinition.skipIfAlreadyInstalled ? true : false}`));
    if(releaseDefinition.baselineOrg)
      console.log(COLOR_HEADER(`Baselined Against Org: ${releaseDefinition.baselineOrg}`));
    console.log(COLOR_HEADER(`Dry-run: ${this.flags.dryrun}`));
    console.log(COLOR_HEADER("---------------------------------------------------------"));

    let releaseResult: ReleaseResult;
    try {

      if(releaseDefinition.promotePackagesBeforeDeploymentToOrg && !this.flags.devhubalias)
      {
         throw new Error("DevHub is mandatory when promote is used within release defintion")
      }

      let props:ReleaseProps = {
        releaseDefinition:releaseDefinition,
        targetOrg: this.flags.targetorg,
        fetchArtifactScript:this.flags.scriptpath,
        isNpm:this.flags.npm,
        scope: this.flags.scope,
        npmrcPath: this.flags.npmrcpath,
        logsGroupSymbol: this.flags.logsgroupsymbol,
        tags: tags,
        isDryRun: this.flags.dryrun,
        waitTime: this.flags.waittime,
        keys: this.flags.keys,
        isGenerateChangelog: this.flags.generatechangelog,
        devhubUserName: this.flags.devhubalias,
        branch: this.flags.branchname
      }


      let releaseImpl: ReleaseImpl = new ReleaseImpl(
       props
      );

      releaseResult = await releaseImpl.exec();

      SFPStatsSender.logCount(
        "release.succeeded",
        tags
      );

    } catch (err) {

      if (err instanceof ReleaseError) {
        releaseResult = err.data;
      } else console.log(err.message);

      SFPStatsSender.logCount(
        "release.failed",
        tags
      );

      // Fail the task when an error occurs
      process.exitCode = 1;
    } finally {
      let totalElapsedTime: number = Date.now() - executionStartTime;

      if (releaseResult) {
        this.printReleaseSummary(releaseResult, totalElapsedTime);
      }

      SFPStatsSender.logCount("release.scheduled",tags);

      SFPStatsSender.logGauge(
        "release.duration",
        totalElapsedTime,
        tags
      );
    }
  }

  private printReleaseSummary(
    releaseResult: ReleaseResult,
    totalElapsedTime: number
  ): void {
    if (this.flags.logsgroupsymbol?.[0])
      console.log(COLOR_HEADER(this.flags.logsgroupsymbol[0], "Release Summary"));

    console.log(
      COLOR_HEADER(`----------------------------------------------------------------------------------------------------`
    ));
    if (releaseResult.installDependenciesResult) {
      console.log(COLOR_HEADER(`\nPackage Dependencies`));
      console.log(COLOR_SUCCESS(`   ${releaseResult.installDependenciesResult.success.length} succeeded`));
      console.log(COLOR_WARNING(`   ${releaseResult.installDependenciesResult.skipped.length} skipped`));
      console.log(COLOR_ERROR(`   ${releaseResult.installDependenciesResult.failed.length} failed`));
    }

    if (releaseResult.deploymentResult) {
      console.log(COLOR_HEADER(`\nDeployment`));
      console.log(COLOR_SUCCESS(`   ${releaseResult.deploymentResult.deployed.length} succeeded`));
      console.log(COLOR_ERROR(`   ${releaseResult.deploymentResult.failed.length} failed`));

      if (releaseResult.deploymentResult.failed.length > 0) {
        console.log(COLOR_ERROR(`\nPackages Failed to Deploy`, releaseResult.deploymentResult.failed.map((packageInfo) => packageInfo.packageMetadata.package_name)));
      }
    }

    console.log(COLOR_TIME(`\nElapsed Time: ${new Date(totalElapsedTime).toISOString().substr(11,8)}`));
    console.log(COLOR_HEADER(
      `----------------------------------------------------------------------------------------------------`
    ));
  }

  protected validateFlags() {
    if (this.flags.npm && !this.flags.scope)
      throw new Error("--scope parameter is required for NPM");
  }
}
