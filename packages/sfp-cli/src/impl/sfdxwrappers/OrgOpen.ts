
import { SFDXCommand } from "@dxatscale/sfpowerscripts.core/lib/command/SFDXCommand"


export default class OrgOpen extends SFDXCommand
{

  public constructor(private aliasOrUsername?:string) {
    super(null, null);
  }


  getSFDXCommand(): string {
   return "sfdx force:org:open"
  }

  getCommandName(): string {
    return "OrgOpen"
  }

  getGeneratedParams(): string {

      return ` --targetusername ${this.aliasOrUsername}`
  }

}