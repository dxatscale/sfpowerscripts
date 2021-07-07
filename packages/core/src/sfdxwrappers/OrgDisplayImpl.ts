import { SFDXCommand } from "../command/SFDXCommand";

export default class OrgDisplayImpl extends SFDXCommand
{

  public constructor(
    working_directory: string,
    target_org: string,
  ) {
    super(target_org, working_directory);
  }


  getSFDXCommand(): string {
   return "sfdx force:org:display"
  }

  getCommandName(): string {
    return "OrgDisplay"
  }

  getGeneratedParams(): string {
    let command = `-u ${this.target_org} --verbose`;
    return command;
  }
  
}