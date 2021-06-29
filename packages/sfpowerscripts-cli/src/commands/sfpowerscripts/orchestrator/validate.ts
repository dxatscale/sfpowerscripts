import { Messages } from "@salesforce/core";
import SfpowerscriptsCommand from "../../../SfpowerscriptsCommand";
import { flags } from '@salesforce/command';
import ValidateImpl, {ValidateMode, ValidateProps} from "../../../impl/validate/ValidateImpl";
import SFPStatsSender from "@dxatscale/sfpowerscripts.core/lib/stats/SFPStatsSender";
import { COLOR_HEADER } from "@dxatscale/sfpowerscripts.core/lib/logger/SFPLogger";

Messages.importMessagesDirectory(__dirname);
const messages = Messages.loadMessages('@dxatscale/sfpowerscripts', 'validate');


export default class Validate extends SfpowerscriptsCommand {

  public static description = messages.getMessage('commandDescription');

  public static examples = [
    `$ sfdx sfpowerscripts:orchestrator:validate -p "POOL_TAG_1,POOL_TAG_2" -u <devHubUsername> -i <clientId> -f <jwt_file>`
  ];

  static aliases = ["sfpowerscripts:orchestrator:validateAgainstPool"];

  protected static flagsConfig = {
    devhubusername: flags.string({
      char: 'u',
      description: messages.getMessage('devhubUsernameFlagDescription'),
      required: true
    }),
    pools: flags.array({
      char: 'p',
      description: messages.getMessage('poolsFlagDescription'),
      required: true
    }),
    jwtkeyfile: flags.filepath({
      char: 'f',
      description: messages.getMessage("jwtKeyFileFlagDescription"),
      required: true
    }),
    clientid: flags.string({
      char: 'i',
      description: messages.getMessage("clientIdFlagDescription"),
      required: true
    }),
    shapefile: flags.string({
      description: messages.getMessage('shapeFileFlagDescription')
    }),
    coveragepercent: flags.integer({
      description: messages.getMessage('coveragePercentFlagDescription'),
      default: 75
    }),
    logsgroupsymbol: flags.array({
      char: "g",
      description: messages.getMessage("logsGroupSymbolFlagDescription")
    }),
    deletescratchorg: flags.boolean({
      char: 'x',
      description: messages.getMessage("deleteScratchOrgFlagDescription"),
      default: false
    }),
    keys: flags.string({
      required: false,
      description: messages.getMessage("keysFlagDescription")
    }),
    visualizechangesagainst: flags.string({
      char: 'c',
      description: messages.getMessage("visualizeChangesAgainstFlagDescription")
    }),
    tag: flags.string({
      description: messages.getMessage("tagFlagDescription"),
    }),
  };

  async execute(): Promise<void> {
    let executionStartTime = Date.now();

    console.log(COLOR_HEADER("-----------sfpowerscripts orchestrator ------------------"));
    console.log(COLOR_HEADER("command: validate"));
    console.log(COLOR_HEADER(`Pools being used: ${this.flags.pools}`));
    console.log(COLOR_HEADER(`Coverage Percentage: ${this.flags.coveragepercent}`));
    console.log(COLOR_HEADER(`Using shapefile to override existing shape of the org: ${this.flags.shapefile?'true':'false'}`));
    console.log(COLOR_HEADER("---------------------------------------------------------"));


    let validateResult: boolean = false;
    try {

    let validateProps: ValidateProps = {
      validateMode: ValidateMode.POOL,
      coverageThreshold: this.flags.coveragepercent,
      logsGroupSymbol: this.flags.logsgroupsymbol,
      devHubUsername: this.flags.devhubusername,
      pools: this.flags.pools,
      jwt_key_file: this.flags.jwtkeyfile,
      client_id: this.flags.clientid,
      shapeFile: this.flags.shapefile,
      isDeleteScratchOrg: this.flags.deletescratchorg,
      keys: this.flags.keys,
      visualizeChangesAgainst: this.flags.visualizechangesagainst
    }

    let validateImpl: ValidateImpl = new ValidateImpl( validateProps);

    let validateResult  = await validateImpl.exec();

     SFPStatsSender.logCount("validate.succeeded",this.flags.tag);

    if (validateResult)
      process.exitCode=0;
    else
      process.exitCode=1;

    } catch (error) {
      validateResult=false;
      console.log(error.message);
      process.exitCode=1;
    } finally {
      let totalElapsedTime: number = Date.now() - executionStartTime;

    if (!validateResult)
       SFPStatsSender.logCount("validate.failed",this.flags.tag);

      
      SFPStatsSender.logGauge(
        "validate.duration",
        totalElapsedTime,
        this.flags.tag
      );

   
    }
  }
}
