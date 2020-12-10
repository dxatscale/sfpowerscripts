import { Messages } from "@salesforce/core";
import SfpowerscriptsCommand from "../../../SfpowerscriptsCommand";


Messages.importMessagesDirectory(__dirname);
const messages = Messages.loadMessages('@dxatscale/sfpowerscripts', 'analyze');


export default class Analyze extends SfpowerscriptsCommand {


  
  public static description = messages.getMessage('commandDescription');

  public static examples = [
    `$ sfdx sfpowerscripts:orchestrator:validate -u <scratchorg> -v <devhub>`
  ];

  execute(): Promise<any> {
    throw new Error("Method not implemented.");
  }
}