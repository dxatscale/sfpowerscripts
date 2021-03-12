import { Messages, SfdxError } from "@salesforce/core";
import SfpowerscriptsCommand from "../../../SfpowerscriptsCommand";
import { flags } from "@salesforce/command";
import { sfdx } from "../../../impl/pool/sfdxnode/parallel";
import PrepareImpl from "../../../impl/prepare/PrepareImpl";
import { loadSFDX } from "../../../impl/pool/sfdxnode/GetNodeWrapper";
import SFPStatsSender from "@dxatscale/sfpowerscripts.core/lib/utils/SFPStatsSender";
import { Stage } from "../../../impl/Stage";
import * as fs from "fs-extra"


Messages.importMessagesDirectory(__dirname);
const messages = Messages.loadMessages("@dxatscale/sfpowerscripts", "prepare");

export default class Prepare extends SfpowerscriptsCommand {
  protected static requiresDevhubUsername = true;
  protected static requiresProject = true;

  protected static flagsConfig = {
    tag: flags.string({
      required: true,
      char: "t",
      description: messages.getMessage("tagDescription"),
    }),
    expiry: flags.number({
      required: false,
      default: 2,
      char: "e",
      description: messages.getMessage("expiryDescription"),
    }),
    maxallocation: flags.number({
      required: false,
      default: 10,
      char: "m",
      description: messages.getMessage("maxallocationDescription"),
    }),
    config: flags.filepath({
      required: false,
      default: "config/project-scratch-def.json",
      char: "f",
      description: messages.getMessage("configDescription"),
    }),
    installall: flags.boolean({
      required: false,
      default: false,
      description: messages.getMessage("installallDescription"),
    }),
    installassourcepackages: flags.boolean({
      required: false,
      description: messages.getMessage("installationModeDescription"),
      dependsOn: ["installall"]
    }),
    artifactfetchscript: flags.filepath({
      required: false,
      char: "s",
      description: messages.getMessage("artifactfetchscriptDescription"),
    }),
     succeedondeploymenterrors:flags.boolean({
      required: false,
      default:false,
      description: messages.getMessage("succeedondeploymenterrorsDescription"),
    }),
    keys: flags.string({
      required: false,
      description: messages.getMessage("keysDescription"),
    }),
    batchsize: flags.number({
      required: false,
      default: 10,
      hidden: true,
      description: messages.getMessage("batchsize"),
    }),
    apiversion: flags.builtin({
      description: messages.getMessage("apiversion"),
    }),
    npm: flags.boolean({
      description: messages.getMessage('npmFlagDescription'),
      exclusive: ['artifactfetchscript'],
      required: false
    }),
    scope: flags.string({
      description: messages.getMessage('scopeFlagDescription'),
      dependsOn: ['npm'],
      required: false
    }),
    npmtag: flags.string({
      description: messages.getMessage('npmTagFlagDescription'),
      dependsOn: ['npm'],
      required: false
    })
  };

  public static description = messages.getMessage("commandDescription");

  public static examples = [
    `$ sfdx sfpowerscripts:orchestrator:prepare -t CI_1  -v <devhub>`,
  ];

  public async execute(): Promise<any> {

    let executionStartTime = Date.now();

    console.log("-----------sfpowerscripts orchestrator ------------------");
    console.log("command: prepare");
    console.log(`Pool Name: ${this.flags.tag}`);
    console.log(`Requested Count of Orgs: ${this.flags.maxallocation}`);
    console.log(`Script provided to fetch artifacts: ${this.flags.artifactfetchscript?'true':'false'}`);
    console.log(`Fetch artifacts from pre-authenticated NPM registry: ${this.flags.npm ? "true" : "false"}`);
    console.log(`All packages in the repo to be installed: ${this.flags.installall}`);
    console.log(`Scratch Orgs to be submitted to pool in case of failures: ${this.flags.succeedondeploymenterrors}`)
    console.log("---------------------------------------------------------");



    if (this.flags.artifactfetchscript && !fs.existsSync(this.flags.artifactfetchscript))
    {
       console.log(`Script path ${this.flags.scriptpath} does not exist, Please provide a valid path to the script file`);
       process.exitCode=1;
       return;
    }

    let tags = {
      stage: Stage.PREPARE,
      poolName:this.flags.tag
    }

    await this.hubOrg.refreshAuth();
    const hubConn = this.hubOrg.getConnection();

    this.flags.apiversion =
      this.flags.apiversion || (await hubConn.retrieveMaxApiVersion());

    loadSFDX();

    let prepareImpl = new PrepareImpl(
      this.hubOrg,
      this.flags.apiversion,
      sfdx,
      this.flags.tag,
      this.flags.expiry,
      this.flags.maxallocation,
      this.flags.config,
      this.flags.batchsize
    );
    prepareImpl.setArtifactFetchScript(this.flags.artifactfetchscript);
    prepareImpl.setInstallationBehaviour(this.flags.installall,this.flags.installassourcepackages,this.flags.succeedondeploymenterrors);
    prepareImpl.setPackageKeys(this.flags.keys);
    prepareImpl.isNpm = this.flags.npm;
    prepareImpl.scope = this.flags.scope;
    prepareImpl.npmTag = this.flags.npmtag;

    try {
      let results= await prepareImpl.poolScratchOrgs();

      let totalElapsedTime=Date.now()-executionStartTime;
      console.log(
        `-----------------------------------------------------------------------------------------------------------`
      );
      console.log(`Provisioned {${results.success}}  scratchorgs out of ${results.totalallocated} requested with ${results.failed} failed in ${this.getFormattedTime(totalElapsedTime)} `)
      console.log(
        `----------------------------------------------------------------------------------------------------------`
      );

      if(results.errorCode)
      {
        switch(results.errorCode)
        {
          case "Max_Capacity": process.exitCode=0;
                              break;
          case "No_Capacity" : process.exitCode=0;
                               break;
          case "Fields_Missing": process.exitCode=1;
                                break;
        }
      }
      else if(results.success==0)
      {
        SFPStatsSender.logGauge(
          "prepare.failedorgs",
          results.failed,
          tags
        );

        process.exitCode=1;
      }
      else
      {
        SFPStatsSender.logGauge(
          "prepare.succeededorgs",
          results.success,
          tags
        );
      }



      SFPStatsSender.logGauge(
        "prepare.duration",
        (Date.now() - executionStartTime),
        tags
      );

    } catch (err) {
      throw new SfdxError("Unable to execute command .. " + err);
    }
  }

  private getFormattedTime(milliseconds: number): string {
    let date = new Date(0);
    date.setSeconds(milliseconds / 1000); // specify value for SECONDS here
    let timeString = date.toISOString().substr(11, 8);
    return timeString;
  }

}
