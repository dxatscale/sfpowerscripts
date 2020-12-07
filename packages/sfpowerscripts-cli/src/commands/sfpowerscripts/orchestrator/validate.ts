import { Messages } from "@salesforce/core";
import SfpowerscriptsCommand from "../../../SfpowerscriptsCommand";
import { flags } from '@salesforce/command';
import ValidateImpl from "@dxatscale/sfpowerscripts.core/lib/validate/ValidateImpl"

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
    })
  };

  async execute(): Promise<any> {
    let validateImpl: ValidateImpl = new ValidateImpl(
      this.flags.devhubalias,
      this.flags.pools,
      this.flags.jwtkeyfile,
      this.flags.clientid,
      this.flags.shapefile
    );

    await validateImpl.exec();
  }
}
