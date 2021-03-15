import { SFDXCommand } from "../SFDXCommand";
import { LoggerLevel } from "../utils/SFPLogger";


export default class PackageVersionListImpl extends SFDXCommand
{
  protected target_org: string;
  protected project_directory: string;
  protected logFile?: any;
  protected loggerLevel?: LoggerLevel;


  public constructor(
    devhub: string
  ) {
    super(devhub, null);
  }

  public async exec(quiet?: boolean): Promise<any> {
    let result =JSON.parse( await super.exec(quiet));
    return result.result;
  }

  getCommandName(): string {
    return "PackageVersionList"
  }
  getGeneratedSFDXCommandWithParams(): string {
    return `sfdx force:package:list --json -v ${this.target_org} `;
  }
  
}


