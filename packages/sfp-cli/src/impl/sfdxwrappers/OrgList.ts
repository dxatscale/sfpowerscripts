
import { SFDXCommand } from "@dxatscale/sfpowerscripts.core/lib/command/SFDXCommand"

export default class OrgList extends SFDXCommand
{

  public constructor(
  ) {
    super(null, null);
  }


  getSFDXCommand(): string {
   return "sfdx force:org:list"
  }

  getCommandName(): string {
    return "OrgList"
  }

  getGeneratedParams(): string {
    return "";
  }

}