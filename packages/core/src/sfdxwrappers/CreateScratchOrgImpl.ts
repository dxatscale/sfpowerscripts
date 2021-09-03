
import { SFDXCommand } from "../command/SFDXCommand";


export default class CreateScratchOrgImpl extends SFDXCommand {

  public constructor(
    working_directory: string,
    private config_file_path: string,
    private devhub: string,
    private alias: string,
    private daysToMaintain: number,
    private adminEmail?:string
  ) {
    super(devhub, working_directory);
  }


  public async exec(quiet?: boolean): Promise<any> {
    let result = await super.exec(quiet, 360000);
    return result;
  }

  getCommandName(): string {
    return "CreateScratchOrg"
  }

  getSFDXCommand(): string {
    return `sfdx force:org:create`
  }
  getGeneratedParams(): string {
    let command = `-v ${this.devhub} -s -f ${this.config_file_path}  -a ${this.alias} -d ${this.daysToMaintain}`;
    if(this.adminEmail)
     command+= ` adminEmail=${this.adminEmail}`
    return command;
  }
}
