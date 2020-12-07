import { Messages, SfdxError } from "@salesforce/core";
import SfpowerscriptsCommand from "../../../SfpowerscriptsCommand";
import { flags } from "@salesforce/command";
import * as path from "path";
import { registerNamespace, sfdx } from "../../../impl/pool/sfdxnode/parallel";
import PrepareScratchOrgPoolImpl from "../../../impl/prepare/PrepareImpl";

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
    installallpackages: flags.boolean({
      required: false,
      default: false,
      description: messages.getMessage("installallpackagesDescription"),
    }),
    artifactfetchscripts: flags.filepath({
      required: false,
      dependsOn: ["installallpackages"],
      char: "s",
      description: messages.getMessage("artifactfetchscriptsDescription"),
    }),
    keys: flags.string({
      required: false,
      description: messages.getMessage("artifactfetchscriptsDescription"),
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
    await this.hubOrg.refreshAuth();
    const hubConn = this.hubOrg.getConnection();

    this.flags.apiversion =
      this.flags.apiversion || (await hubConn.retrieveMaxApiVersion());

    loadSFDX();

    let scratchOrgPoolImpl = new PrepareScratchOrgPoolImpl(
      this.hubOrg,
      this.flags.apiversion,
      sfdx,
      this.flags.tag,
      this.flags.expiry,
      this.flags.maxallocation,
      this.flags.config,
      this.flags.batchsize,
      this.flags.artifactfetchscripts,
      this.flags.installallpackages,
      this.flags.keys
    );

    try {
      return !(await scratchOrgPoolImpl.poolScratchOrgs());
    } catch (err) {
      throw new SfdxError("Unable to execute command .. " + err);
    }
  }
}

export function loadSFDX() {
  let salesforce_alm_path = "";
  try {
    salesforce_alm_path = path.dirname(require.resolve("salesforce-alm"));
  } catch (error) {
    console.log(error);
    throw error;
  }

  registerNamespace({
    commandsDir: path.join(salesforce_alm_path, "commands"),
    namespace: "force",
  });
}
