
import { SFDXCommand } from "../command/SFDXCommand";


export default class InstallUnlockedPackageImpl extends SFDXCommand {
 
  public constructor(
    working_directory: string,
    private targetUserName:string,
    private packageId:string,
    private waitTime:string,
    private installationkey?:string,
    private securityType?:string,
    private upgradeType?:string
  ) {
    super(targetUserName, working_directory);
  }


  public async exec(quiet?: boolean): Promise<any> {
    let result=await super.exec(quiet);
    return result;
  }

  getCommandName(): string {
    return "InstallUnlockedPackageImpl"
  }

  getSFDXCommand(): string {
    return `sfdx force:package:install`;
  }
  
  
  getGeneratedParams(): string {
    let command = `--targetusername ${this.targetUserName} --package ${this.packageId} --apexcompile=package --noprompt --wait ${this.waitTime}`;
    if(this.installationkey)
     command+=` --installationkey=${this.installationkey}`;
    if(this.securityType)
     command+=` --securitytype=${this.securityType}`;
    if(this.upgradeType)
     command+=` --upgradeType=${this.upgradeType}`
     
    return command;
  }

  
}
