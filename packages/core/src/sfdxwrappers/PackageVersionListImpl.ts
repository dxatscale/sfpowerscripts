import { SFDXCommand } from "../command/SFDXCommand";

export default class PackageVersionListImpl extends SFDXCommand
{
 

  public constructor(
    target_org: string
  ) {
    super(target_org, null);
  }

  getSFDXCommand(): string {
    return `sfdx force:package:list`
  }
  getGeneratedParams(): string {
    return `-v ${this.target_org}`
  }

  getCommandName(): string {
    return "PackageVersionList"
  }


}
