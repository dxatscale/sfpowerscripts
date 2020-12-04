import child_process = require("child_process");
import { delay } from "../utils/Delay";
import MDAPIPackageGenerator from "../generators/MDAPIPackageGenerator";
import {
  copyFileSync,
} from "fs";
import { onExit } from "../utils/OnExit";
import ManifestHelpers from "../manifest/ManifestHelpers";
import SFPLogger from "../utils/SFPLogger";
const path = require("path");


export interface DeploySourceResult {
  deploy_id: string;
  result: boolean;
  message: string;
}

export default class DeploySourceToOrgImpl {
  private mdapiDir: string;

  public constructor(
    private target_org: string,
    private project_directory: string,
    private source_directory: string,
    private deployment_options: any,
    private isToBreakBuildIfEmpty: boolean
  ) {}

  public async exec(): Promise<DeploySourceResult> {
    let commandExecStatus: boolean = false;
    let deploySourceResult = {} as DeploySourceResult;

      //Check empty conditions
      let status = MDAPIPackageGenerator.isToBreakBuildForEmptyDirectory(this.project_directory,this.source_directory,this.isToBreakBuildIfEmpty);
      if (status.result == "break") {
        deploySourceResult.result = false;
        deploySourceResult.message = status.message;
        return deploySourceResult;
      } else if (status.result == "skip") {
        deploySourceResult.result = true;
        deploySourceResult.message = "skip:"+status.message;
        return deploySourceResult;
      }

      SFPLogger.log("Converting source to mdapi");
      let mdapiPackage = await MDAPIPackageGenerator.getMDAPIPackageFromSourceDirectory(
        this.project_directory,
        this.source_directory
      );
      this.mdapiDir = mdapiPackage.mdapiDir;
      ManifestHelpers.printMetadataToDeploy(mdapiPackage.manifest);

    try {
      if (this.deployment_options["checkonly"])
        copyFileSync(
          this.deployment_options["validation_ignore"],
          path.join(this.project_directory, ".forceignore")
        );
    } catch (err) {
      //Do something here
      SFPLogger.log("Validation Ignore not found, using .forceignore");
    }





    //Get Deploy ID
    let deploy_id = "";
    try {
      let command = this.buildExecCommand();
      console.log(command);
      let result = child_process.execSync(command, {
        cwd: this.project_directory,
        encoding: "utf8",
      });

      let resultAsJSON = JSON.parse(result);
      deploy_id = resultAsJSON.result.id;
    } catch (error) {
      deploySourceResult.result = false;
      deploySourceResult.message = error;
      return deploySourceResult;
    }

    if (this.deployment_options["checkonly"])
      console.log(
        `Validation only deployment  is in progress....  Unleashing the power of your code!`
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



  private async getFinalDeploymentStatus(deploy_id: string): Promise<string> {
    let messageString = "";
    try {
      //Print final output
      let child = child_process.exec(
        `npx sfdx force:mdapi:deploy:report  -i ${deploy_id} -u ${this.target_org}`,
        { cwd: this.project_directory, encoding: "utf8" }
      );

      child.stderr.on("data", (data) => {
        messageString += data.toString();
      });

      child.stdout.on("data", (data) => {
        messageString += data.toString();
      });

      await onExit(child);
      return messageString;
    } catch (err) {
      return messageString;
    }
  }

  private buildExecCommand(): string {
    let apexclasses;

    let command = `npx sfdx force:mdapi:deploy -u ${this.target_org}`;

    if (this.deployment_options["checkonly"]) command += ` -c`;

    //directory
    command += ` -d ${this.mdapiDir}`;

    //add json
    command += ` --json`;

    if (this.deployment_options["testlevel"] == "RunApexTestSuite") {
      //testlevel
      command += ` -l RunSpecifiedTests`;
      apexclasses =  this.convertApexTestSuiteToListOfApexClasses(
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

    if (this.deployment_options["ignore_warnings"]) {
      command += ` --ignorewarnings`;
    }
    if (this.deployment_options["ignore_errors"]) {
      command += ` --ignoreerrors`;
    }

    return command;
  }

  private convertApexTestSuiteToListOfApexClasses(
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






}
