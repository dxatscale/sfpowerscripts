import { flags, SfdxCommand } from "@salesforce/command";
import { Messages, Org } from "@salesforce/core";
import ScratchOrg from "@dxatscale/sfpowerscripts.core/lib/scratchorg/ScratchOrg";
import { AnyJson } from "@salesforce/ts-types";
import PoolFetchImpl from "../../../impl/pool/PoolFetchImpl";
import * as fs from "fs-extra";
import SFPLogger, { LoggerLevel } from "@dxatscale/sfpowerscripts.core/lib/logger/SFPLogger";
import InstalledAritfactsFetcher from "@dxatscale/sfpowerscripts.core/lib/artifacts/InstalledAritfactsFetcher";
import InstalledArtifactsDisplayer from "@dxatscale/sfpowerscripts.core/lib/display/InstalledArtifactsDisplayer";
import InstalledPackageDisplayer from "@dxatscale/sfpowerscripts.core/lib/display/InstalledPackagesDisplayer";
import { COLOR_KEY_MESSAGE } from "@dxatscale/sfpowerscripts.core/lib/logger/SFPLogger";
import InstalledPackagesFetcher from "@dxatscale/sfpowerscripts.core/lib/package/packageQuery/InstalledPackagesFetcher";
// Initialize Messages with the current plugin directory
Messages.importMessagesDirectory(__dirname);

// Load the specific messages for this file. Messages from @salesforce/command, @salesforce/core,
// or any library that is using the messages framework can also be loaded this way.
const messages = Messages.loadMessages(
  "@dxatscale/sfpowerscripts",
  "scratchorg_poolFetch"
);

export default class Fetch extends SfdxCommand {
  public static description = messages.getMessage("commandDescription");

  protected static requiresDevhubUsername = true;
  protected static requiresProject = true;

  public static examples = [
    `$ sfdx sfpowerkit:pool:fetch -t core `,
    `$ sfdx sfpowerkit:pool:fetch -t core -v devhub`,
    `$ sfdx sfpowerkit:pool:fetch -t core -v devhub -m`,
    `$ sfdx sfpowerkit:pool:fetch -t core -v devhub -s testuser@test.com`
  ];

  protected static flagsConfig = {
    tag: flags.string({
      char: "t",
      description: messages.getMessage("tagDescription"),
      required: true
    }),
    alias: flags.string({
      char: "a",
      description: messages.getMessage("aliasDescription"),
      required: false,
    }),
    sendtouser: flags.string({
      char: "s",
      description: messages.getMessage("sendToUserDescription"),
      required: false,
    }),
    setdefaultusername: flags.boolean({
      char: "d",
      description: messages.getMessage("setdefaultusernameDescription"),
      required: false,
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
        "FATAL"
      ]
    })
  };

  public async run(): Promise<AnyJson> {
    if (!fs.existsSync("sfdx-project.json")) throw new Error("This command must be run in the root directory of a SFDX project");


    await this.hubOrg.refreshAuth();
    const hubConn = this.hubOrg.getConnection();

    SFPLogger.log(COLOR_KEY_MESSAGE(`Fetching a scratch org from pool ${ this.flags.tag} in Org ${this.hubOrg.getOrgId()}`),LoggerLevel.INFO);


    this.flags.apiversion =
      this.flags.apiversion || (await hubConn.retrieveMaxApiVersion());

    let fetchImpl = new PoolFetchImpl(
      this.hubOrg,
      this.flags.tag,
      false,
      false,
      this.flags.sendtouser,
      this.flags.alias,
      this.flags.setdefaultusername
    );

    if(this.flags.json)
     SFPLogger.logLevel = LoggerLevel.HIDE;

    let result = await fetchImpl.execute();

    if (!this.flags.json && !this.flags.sendtouser) {
      await this.displayOrgContents(result);

      this.ux.log(`======== Scratch org details ========`);
      let list = [];
      for (let [key, value] of Object.entries(result)) {
        if (value) {
          list.push({ key: key, value: value });
        }
      }
      this.ux.table(list, ["key", "value"]);
    }

    return result;
  }

  /**
   * Display artifacts and managed packages installed in the org
   * @param soDetail
   */
  private async displayOrgContents(soDetail: ScratchOrg) {
    try {
      const scratchOrgConnection = (await Org.create({ aliasOrUsername: soDetail.username })).getConnection();
      let installedPackagesFetcher = new InstalledPackagesFetcher(scratchOrgConnection);
      let installedManagedPackages = await installedPackagesFetcher.fetchManagedPackages();
      SFPLogger.log(
        "Installed managed packages:",
        LoggerLevel.INFO
      );
      InstalledPackageDisplayer.printInstalledPackages(installedManagedPackages, null);

      let installedArtifacts = await InstalledAritfactsFetcher.getListofArtifacts(soDetail.username);
      InstalledArtifactsDisplayer.printInstalledArtifacts(installedArtifacts, null);
    } catch (error) {
      SFPLogger.log(
        "Failed to query packages/artifacts installed in the org",
        LoggerLevel.ERROR
      );
    }
  }
}
