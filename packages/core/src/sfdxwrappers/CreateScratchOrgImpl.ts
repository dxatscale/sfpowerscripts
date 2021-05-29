
import { SFDXCommand } from "../SFDXCommand";


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
    let result =JSON.parse( await super.exec(quiet));
    return result.result;
  }

  getCommandName(): string {
    return "CreateScratchOrg"
  }
  
  getGeneratedSFDXCommandWithParams(): string {
    let command = `sfdx force:org:create -v ${this.devhub} -s -f ${this.config_file_path} --json -a ${this.alias} -d ${this.daysToMaintain}`;
    if(this.adminEmail)
     command+= ` adminEmail=${this.adminEmail}`
    return command;
  }

  
}
