import child_process = require("child_process");
import { onExit } from "../../utils/OnExit";
import { isNullOrUndefined } from "util";
import ProjectConfig from "../../project/ProjectConfig";
import SFPLogger from "../../utils/SFPLogger";
const path = require("path");
import * as fs from "fs-extra";

export type DeltaPackage = {
  deltaDirectory: string;
  isDestructiveChangesFound?: boolean;
  destructiveChangesPath?: string;
  destructiveChanges?: any;
};

export default class CreateDeltaPackageImpl {
  deltaDirectory: string;

  public constructor(
    private projectDirectory: string,
    private sfdx_package: string,
    private revisionFrom: string,
    private revisionTo: string,
    private generateDestructiveManifest: boolean,
    private options: any
  ) {}

  public async exec(): Promise<DeltaPackage> {
    if (isNullOrUndefined(this.projectDirectory)) {
      this.deltaDirectory = isNullOrUndefined(this.sfdx_package)
        ? "src_delta"
        : `${this.sfdx_package}_src_delta`;
    } else {
      this.deltaDirectory = path.join(
        this.projectDirectory,
        isNullOrUndefined(this.sfdx_package)
          ? "src_delta"
          : `${this.sfdx_package}_src_delta`
      );
    }

    //If package is provided, do delta only for that package
    if (!isNullOrUndefined(this.sfdx_package)) {
      //Get Package Descriptor
      let packageDescriptor = ProjectConfig.getSFDXPackageDescriptor(
        this.projectDirectory,
        this.sfdx_package
      );
      let packageDirectory: string = packageDescriptor["path"];
      this.options["only_diff_for"] = packageDirectory;
    } else {
      let sfdxManifest = ProjectConfig.getSFDXPackageManifest(
        this.projectDirectory
      );
      if (sfdxManifest["packageDirectories"].length > 1) {
        throw new Error(
          "Multiple Package Directories encountered, Please ensure each of these entries have a package "+
          "name and the name of the package is passed on to this command"
        );
      }
    }

    //Command
    let command = this.buildExecCommand();
    SFPLogger.log("Executing command", command);

    let child = child_process.exec(
      command,
      {
        maxBuffer: 1024 * 1024 * 5,
        encoding: "utf8",
        cwd: this.projectDirectory,
      }
    );

    child.stdout.on("data", (data) => {
      SFPLogger.log(data.toString());
    });
    child.stderr.on("data", (data) => {
      SFPLogger.log(data.toString());
    });

    await onExit(child);

    if (!isNullOrUndefined(this.sfdx_package)) {
      // Temporary fix when a package is provide, make it default and
      //provide package name, so it can be converted to a source artifect
      let sfdxManifest = JSON.parse(
        fs.readFileSync(
          path.join(this.deltaDirectory, "sfdx-project.json"),
          "utf8"
        )
      );
      sfdxManifest["packageDirectories"][0]["default"] = true; //add default = true
      sfdxManifest["packageDirectories"][0]["package"] = this.sfdx_package; //add package.back
      fs.writeFileSync(
        path.join(this.deltaDirectory, "sfdx-project.json"),
        JSON.stringify(sfdxManifest)
      );
    }

    let destructiveChanges: any;
    let isDestructiveChangesFound = false;
    let destructiveChangesPath = path.join(
      this.deltaDirectory,
      "destructiveChanges.xml"
    );
    if (fs.existsSync(destructiveChangesPath)) {
      destructiveChanges = JSON.parse(
        fs.readFileSync(destructiveChangesPath, "utf8")
      );
      isDestructiveChangesFound = true;
    } else {
      destructiveChangesPath = null;
    }

    return {
      deltaDirectory: this.deltaDirectory,
      isDestructiveChangesFound,
      destructiveChangesPath,
      destructiveChanges,
    };
  }

  private buildExecCommand(): string {
    let command = `sfdx sfpowerkit:project:diff`;

    if (!isNullOrUndefined(this.revisionTo))
      command += ` -t  ${this.revisionTo}`;

    if (!isNullOrUndefined(this.revisionFrom))
      command += ` -r  ${this.revisionFrom}`;

    if (this.generateDestructiveManifest) command += ` -x`;

    command += ` -d  ${this.deltaDirectory}`;

    if (!isNullOrUndefined(this.options["bypass_directories"]))
      command += ` -b  ${this.options["bypass_directories"]}`;

    if (!isNullOrUndefined(this.options["only_diff_for"]))
      command += ` -p   ${this.options["only_diff_for"]}`;

    if (!isNullOrUndefined(this.options["apiversion"]))
      command += ` --apiversion  ${this.options["apiversion"]}`;

    return command;
  }
}
