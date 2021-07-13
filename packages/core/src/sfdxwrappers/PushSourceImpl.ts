import { SFDXCommand } from "../command/SFDXCommand";

export default class PushSourceImpl extends SFDXCommand{

  constructor(
    protected target_org: string,
    protected project_directory: string
  ) {
    super(target_org, project_directory);
  }

  public getSFDXCommand(): string {
    return `sfdx force:source:push`;
  }

  public getGeneratedParams(): string {
    return `-u ${this.target_org} -f`;
  }

  public getCommandName() {
    return "PushSourceToOrgImpl";
  }
}