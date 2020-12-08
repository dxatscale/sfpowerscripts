import { Messages, SfdxError } from "@salesforce/core";
import SfpowerscriptsCommand from "../../../SfpowerscriptsCommand";
import { flags } from "@salesforce/command";
import { sfdx } from "../../../impl/pool/sfdxnode/parallel";
import PrepareImpl from "../../../impl/prepare/PrepareImpl";
import { loadSFDX } from "../../../impl/pool/sfdxnode/GetNodeWrapper";
import SFPStatsSender from "@dxatscale/sfpowerscripts.core/lib/utils/SFPStatsSender";
import { Stage } from "../../../impl/Stage";


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
      default:true,
      description: messages.getMessage("installationModeDescription"),
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
  };

  public static description = messages.getMessage("commandDescription");

  public static examples = [
    `$ sfdx sfpowerscripts:orchestrator:prepare -t CI_1  -v <devhub>`,
  ];

  public async execute(): Promise<any> {

    let executionStartTime = Date.now();


    console.log("-----------sfpowerscripts orchestrator ------------------");
    console.log("Stage: prepare");
    console.log(`Requested Count of Orgs: ${this.flags.maxallocation}`);
    console.log(`All packages in the repo to be preinstalled: ${this.flags.installall}`);
    console.log("---------------------------------------------------------");


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
    prepareImpl.setArtifactFetchScript(this.flags.artifactfetchscripts);
    prepareImpl.setInstallationBehaviour(this.flags.installall,this.flags.installassourcepackages,this.flags.succeedondeploymenterrors);
    prepareImpl.setPackageKeys(this.flags.keys);

    try {
      let results= await prepareImpl.poolScratchOrgs();
      if(results.success==0)
      {
        console.log("Unable to create atleast one scratch org in the pool");
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

 
}


