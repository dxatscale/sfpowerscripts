import { Messages } from "@salesforce/core";
import SfpowerscriptsCommand from "../../../SfpowerscriptsCommand";
import { flags } from '@salesforce/command';
import ValidateImpl from "../../../impl/validate/ValidateImpl";
import SFPStatsSender from "@dxatscale/sfpowerscripts.core/lib/utils/SFPStatsSender";

Messages.importMessagesDirectory(__dirname);
const messages = Messages.loadMessages('@dxatscale/sfpowerscripts', 'validate');


export default class Validate extends SfpowerscriptsCommand {

  public static description = messages.getMessage('commandDescription');

  public static examples = [
    `$ sfdx sfpowerscripts:orchestrator:validate -u <scratchorg> -v <devhub>`
  ];

  protected static flagsConfig = {
    devhubalias: flags.string({
      char: 'v',
      description: messages.getMessage('devhubAliasFlagDescription'),
      default: 'HubOrg',
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
    })
  };

  async execute(): Promise<void> {
    let executionStartTime = Date.now();


    console.log("-----------sfpowerscripts orchestrator ------------------");
    console.log("command: validate");
    console.log(`Coverage Percentage: ${this.flags.coveragepercent}`);
    console.log(`Using shapefile: ${this.flags.shapefile?'true':'false'}`);
    console.log(`Pools being used: ${this.flags.pools}`);
    console.log("---------------------------------------------------------");


    let validateResult: boolean;
    try {

    let validateImpl: ValidateImpl = new ValidateImpl(
      this.flags.devhubalias,
      this.flags.pools,
      this.flags.jwtkeyfile,
      this.flags.clientid,
      this.flags.shapefile,
      this.flags.coveragepercent,
      this.flags.logsgroupsymbol
    );

    let validateResult  = await validateImpl.exec();

    if (validateResult)
      process.exitCode=0;
    else
      process.exitCode=1;

    } catch (error) {
      console.log(error.message);
      process.exitCode=1;
    } finally {
      let totalElapsedTime: number = Date.now() - executionStartTime;

      SFPStatsSender.logGauge(
        "validate.duration",
        totalElapsedTime
      );

      if (validateResult)
        SFPStatsSender.logCount("validate.succeeded");
      else
        SFPStatsSender.logCount("validate.failed");
    }
  }
}
