import child_process = require("child_process");
import { delay } from "../Delay";
import rimraf = require("rimraf");
import {
  copyFile,
  copyFileSync,
  readdirSync,
  readFileSync,
  fstat,
  existsSync,
  stat,
} from "fs";
import { isNullOrUndefined } from "util";
import { onExit } from "../OnExit";
let path = require("path");
import ignore from "ignore";

export interface DeploySourceResult {
  deploy_id: string;
  result: boolean;
  message: string;
}

export default class DeploySourceToOrgImpl {
  temp_folder: string;

  public constructor(
    private target_org: string,
    private project_directory: string,
    private source_directory: string,
    private deployment_options: any,
    private isToBreakBuildIfEmpty: boolean
  ) {
    this.temp_folder = `${this.makefolderid(5)}_mdapi`;
  }

  public async exec(): Promise<DeploySourceResult> {
    let commandExecStatus: boolean = false;
    let deploySourceResult = {} as DeploySourceResult;

    //Clean mdapi directory
    rimraf.sync(this.temp_folder);

    //Check empty conditions
    let status = this.isToBreakBuildForEmptyDirectory();
    if (status.result == "break") {
      deploySourceResult.result = false;
      deploySourceResult.message = status.message;
      return deploySourceResult;
    } else if (status.result == "skip") {
      deploySourceResult.result = true;
      deploySourceResult.message = status.message;
      return deploySourceResult;
    }

    console.log("Converting source to mdapi");
    await this.convertSourceToMDAPI();

    try {
      if (this.deployment_options["checkonly"])
        copyFileSync(
          this.deployment_options["validation_ignore"],
          path.join(this.project_directory, ".forceignore")
        );
    } catch (err) {
      //Do something here

      console.log("Validation Ignore not found, using .forceignore");
    }

    //Get Deploy ID
    let deploy_id = "";
    try {
      let command = await this.buildExecCommand();
      console.log(command);
      let result = child_process.execSync(command, {
        cwd: this.project_directory,
        encoding: "utf8",
      });

      let resultAsJSON = JSON.parse(result);
      deploy_id = resultAsJSON.result.id;
    } catch (error) {
      deploySourceResult.result = false;
      deploySourceResult.message = JSON.parse(error.stdout).message;
      return deploySourceResult;
    }

    if (this.deployment_options["checkonly"])
      console.log(
        `Validation is in progress....  Unleashing the power of your code!`
      );
    else
      console.log(
        `Deployment is in progress....  Unleashing the power of your code!`
      );

    // Loop till deployment completes to show status
    let result;
    while (true) {
      try {
        result = child_process.execSync(
          `npx sfdx force:mdapi:deploy:report --json -i ${deploy_id} -u ${this.target_org}`,
          {
            cwd: this.project_directory,
            encoding: "utf8",
            stdio: ["pipe", "pipe", "ignore"],
          }
        );
      } catch (err) {
        if (this.deployment_options["checkonly"])
          console.log(`Validation Failed`);
        else console.log(`Deployment Failed`);
        break;
      }
      let resultAsJSON = JSON.parse(result);

      if (resultAsJSON["status"] == 1) {
        console.log("Validation/Deployment Failed");
        commandExecStatus = false;
        break;
      } else if (
        resultAsJSON["result"]["status"] == "InProgress" ||
        resultAsJSON["result"]["status"] == "Pending"
      ) {
        console.log(
          `Processing ${resultAsJSON.result.numberComponentsDeployed} out of ${resultAsJSON.result.numberComponentsTotal}`
        );
      } else if (resultAsJSON["result"]["status"] == "Succeeded") {
        console.log("Validation/Deployment Succeeded");
        commandExecStatus = true;
        break;
      }

      await delay(30000);
    }

    deploySourceResult.message = await this.getFinalDeploymentStatus(deploy_id);
    deploySourceResult.result = commandExecStatus;
    deploySourceResult.deploy_id = deploy_id;
    return deploySourceResult;
  }

  private isToBreakBuildForEmptyDirectory(): {
    message: string;
    result: string;
  } {
    let directoryToCheck;
    let status: { message: string; result: string } = {
      message: "",
      result: "",
    };

    if (!isNullOrUndefined(this.project_directory)) {
      directoryToCheck = path.join(
        this.project_directory,
        this.source_directory
      );
    } else directoryToCheck = this.source_directory;

    try {
      if (!existsSync(directoryToCheck)) {
        //Folder do not exists, break build
        if (this.isToBreakBuildIfEmpty) {
          status.message = `Folder not Found , Stopping build as isToBreakBuildIfEmpty is ${this.isToBreakBuildIfEmpty}`;
          status.result = "break";
        } else {
          status.message = `Folder not Found , Skipping task as isToBreakBuildIfEmpty is ${this.isToBreakBuildIfEmpty}`;
          status.result = "skip";
        }
        return status;
      } else if (this.isEmptyFolder(directoryToCheck)) {
        if (this.isToBreakBuildIfEmpty) {
          status.message = `Folder is Empty , Stopping build as isToBreakBuildIfEmpty is ${this.isToBreakBuildIfEmpty}`;
          status.result = "break";
        } else {
          status.message = `Folder is Empty, Skipping task as isToBreakBuildIfEmpty is ${this.isToBreakBuildIfEmpty}`;
          status.result = "skip";
        }
        return status;
      } else {
        status.result = "continue";
        return status;
      }
    } catch (err) {
      if (err.code === "ENOENT") {
        throw err; // Re-throw error if .forceignore does not exist
      }
      else if (!this.isToBreakBuildIfEmpty) {
        status.message = `Something wrong with the path provided  ${directoryToCheck},,but skipping `;
        status.result = "skip";
        return status;
      } else throw err;
    }
  }

  private async getFinalDeploymentStatus(deploy_id: string): Promise<string> {
    let messageString = "";
    try {
      //Print final output
      let child = child_process.exec(
        `npx sfdx force:mdapi:deploy:report  -i ${deploy_id} -u ${this.target_org}`,
        { cwd: this.project_directory, encoding: "utf8" },
        (error, stdout, stderr) => {}
      );

      child.stdout.on("data", (data) => {
        messageString += data.toString();
      });

      await onExit(child);
      return messageString;
    } catch (err) {
      return messageString;
    }
  }

  private async buildExecCommand(): Promise<string> {
    let apexclasses;

    let command = `npx sfdx force:mdapi:deploy -u ${this.target_org}`;

    if (this.deployment_options["checkonly"]) command += ` -c`;

    //directory
    command += ` -d ${this.temp_folder}`;

    //add json
    command += ` --json`;

    if (this.deployment_options["testlevel"] == "RunApexTestSuite") {
      //testlevel
      command += ` -l RunSpecifiedTests`;
      apexclasses = await this.convertApexTestSuiteToListOfApexClasses(
        this.deployment_options["apextestsuite"]
      );
      command += ` -r ${apexclasses}`;
    } else if (this.deployment_options["testlevel"] == "RunSpecifiedTests") {
      command += ` -l RunSpecifiedTests`;
      apexclasses = this.deployment_options["specified_tests"];
      command += ` -r ${apexclasses}`;
    } else {
      command += ` -l ${this.deployment_options["testlevel"]}`;
    }

    return command;
  }

  private async convertApexTestSuiteToListOfApexClasses(
    apextestsuite: string
  ): Promise<string> {
    console.log(
      `Converting an apex test suite  ${apextestsuite} to its consituent apex test classes`
    );

    let result = child_process.execSync(
      `npx sfdx sfpowerkit:source:apextestsuite:convert  -n ${apextestsuite} --json`,
      { cwd: this.project_directory, encoding: "utf8" }
    );

    let resultAsJSON = JSON.parse(result);
    if (resultAsJSON["status"] == 0) {
      return resultAsJSON["result"];
    } else {
      throw new Error(
        `Unable to convert apex test suite ${apextestsuite} ${resultAsJSON["message"]}`
      );
    }
  }

  private async convertSourceToMDAPI(): Promise<void> {
    try {
      if (!isNullOrUndefined(this.project_directory))
        console.log(
          `Converting to Source Format ${this.source_directory} in project directory  ${this.project_directory}`
        );
      else
        console.log(
          `Converting to Source Format ${this.source_directory} in project directory`
        );
      child_process.execSync(
        `npx sfdx force:source:convert -r ${this.source_directory}  -d ${this.temp_folder}`,
        { cwd: this.project_directory, encoding: "utf8" }
      );
      console.log("Converting to Source Format Completed");
    } catch (error) {
      console.log("Unable to convert source, exiting" + error.code);
      throw error;
    }
  }

  private isEmptyFolder(source_directory): boolean {
    let files: string[] = readdirSync(source_directory);

    // Construct file paths that are relative to the project directory.
    files.forEach( (file, index, files) => {
      let filepath = path.join(source_directory, file);
      files[index] = path.relative(process.cwd(), filepath);
    });

    // Ignore files that are listed in .forceignore
    let forceignorePath = path.join(process.cwd(), ".forceignore");
    files = ignore()
      .add(readFileSync(forceignorePath).toString()) // Add ignore patterns from '.forceignore'.
      .filter(files);

    if (files == null || files.length === 0) return true;
    else return false;
  }

  private makefolderid(length): string {
    var result = "";
    var characters =
      "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
    var charactersLength = characters.length;
    for (var i = 0; i < length; i++) {
      result += characters.charAt(Math.floor(Math.random() * charactersLength));
    }
    return result;
  }
}
