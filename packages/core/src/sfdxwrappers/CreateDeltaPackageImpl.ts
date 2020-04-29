import child_process = require("child_process");
import { onExit } from "../OnExit";
import { isNullOrUndefined } from "util";

export default class CreateDeltaPackageImpl {
  public constructor(
    private projectDirectory: string,
    private sfdx_package: string,
    private revisionFrom: string,
    private revisionTo: string,
    private generateDestructiveManifest: boolean,
    private options:any
  ) {}

  public async exec(command: string): Promise<void> {
    let child = child_process.exec(
      command,
      { encoding: "utf8", cwd: this.projectDirectory },
      (error, stdout, stderr) => {
        if (error) throw error;
      }
    );

    child.stdout.on("data", data => {
      console.log(data.toString());
    });
    child.stderr.on("data", data => {
      console.log(data.toString());
    });

    await onExit(child);
  }

  public async buildExecCommand(): Promise<string> {
    let command;
    command = `npx sfdx sfpowerkit:project:diff`;

    if (!isNullOrUndefined(this.revisionTo))
      command += ` -t  ${this.revisionTo}`;

    if (!isNullOrUndefined(this.revisionFrom))
      command += ` -r  ${this.revisionFrom}`;

    if (this.generateDestructiveManifest) command += ` -x`;

    command += ` -d  ${this.sfdx_package}_src_delta`;


    if(!isNullOrUndefined(this.options['bypass_directories']))
    command += ` -b  ${this.options['bypass_directories']}`;

    if(!isNullOrUndefined(this.options['only_diff_for']))
    command += ` -p   ${this.options['only_diff_for']}`;

    if(!isNullOrUndefined(this.options['apiversion']))
    command += ` --apiversion  ${this.options['apiversion']}`;




    return command;
  }
}
