import child_process = require("child_process");
import { onExit } from "../OnExit";
import { isNullOrUndefined } from "util";
const path = require("path");
const fs = require("fs-extra");

export type DeltaPackage = {
  deltaDirectory:string;
  isDestructiveChangesFound?: boolean;
  destructiveChangesPath?:string
  destructiveChanges?: any;
};

export default class CreateDeltaPackageImpl {
  public constructor(
    private projectDirectory: string,
    private sfdx_package: string,
    private revisionFrom: string,
    private revisionTo: string,
    private generateDestructiveManifest: boolean,
    private options: any
  ) {}

  public async exec(): Promise<DeltaPackage> {

  
    //Command
    let command = this.buildExecCommand();
    console.log("Executing command", command);

    let child = child_process.exec(
      command,
      {
        maxBuffer: 1024 * 1024 * 5,
        encoding: "utf8",
        cwd: this.projectDirectory,
      },
      (error, stdout, stderr) => {
        if (error) throw error;
      }
    );

    child.stdout.on("data", (data) => {
      console.log(data.toString());
    });
    child.stderr.on("data", (data) => {
      console.log(data.toString());
    });

    await onExit(child);

    //Generate artifact
    let deltaDirectory:string;

    if(isNullOrUndefined(this.projectDirectory))
    {
      deltaDirectory=`${this.sfdx_package}_src_delta`;
    }
    else
    {
      deltaDirectory = path.join(this.projectDirectory,`${this.sfdx_package}_src_delta`);
    }

    let destructiveChanges:any;
    let isDestructiveChangesFound=false;
    let destructiveChangesPath = path.join(deltaDirectory,"destructiveChanges.xml");
    if(fs.existsSync(destructiveChangesPath))
    {
            destructiveChanges = JSON.parse(fs.readFileSync(destructiveChangesPath, "utf8"));
            isDestructiveChangesFound=true;
    }
    else
    {
      destructiveChangesPath=null;
    }
    

    return {deltaDirectory,isDestructiveChangesFound,destructiveChangesPath,destructiveChanges};
  }

  private buildExecCommand(): string {
    let command = `sfdx sfpowerkit:project:diff`;

    if (!isNullOrUndefined(this.revisionTo))
      command += ` -t  ${this.revisionTo}`;

    if (!isNullOrUndefined(this.revisionFrom))
      command += ` -r  ${this.revisionFrom}`;

    if (this.generateDestructiveManifest) command += ` -x`;

    command += ` -d  ${this.sfdx_package}_src_delta`;

    if (!isNullOrUndefined(this.options["bypass_directories"]))
      command += ` -b  ${this.options["bypass_directories"]}`;

    if (!isNullOrUndefined(this.options["only_diff_for"]))
      command += ` -p   ${this.options["only_diff_for"]}`;

    if (!isNullOrUndefined(this.options["apiversion"]))
      command += ` --apiversion  ${this.options["apiversion"]}`;

    return command;
  }
}
