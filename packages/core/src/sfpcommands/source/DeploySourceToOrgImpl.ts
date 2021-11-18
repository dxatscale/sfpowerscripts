import child_process = require("child_process");
import { delay } from "../../utils/Delay";
import { onExit } from "../../utils/OnExit";
import SFPLogger, { COLOR_KEY_MESSAGE, COLOR_SUCCESS, COLOR_TRACE, Logger, LoggerLevel } from "../../logger/SFPLogger";
import PackageEmptyChecker from "../../package/PackageEmptyChecker";
import PackageMetadataPrinter from "../../display/PackageMetadataPrinter";
import ConvertSourceToMDAPIImpl from "../../sfdxwrappers/ConvertSourceToMDAPIImpl";
import PackageManifest from "../../package/PackageManifest";
import DeployErrorDisplayer from "../../display/DeployErrorDisplayer";
import * as fs from "fs-extra";
const path = require("path");
import DeploymentExecutor, { DeploySourceResult } from "./DeploymentExecutor";
const Table = require("cli-table");

export default class DeploySourceToOrgImpl implements DeploymentExecutor {
  private mdapiDir: string;

  public constructor(
    private target_org: string,
    private project_directory: string,
    private source_directory: string,
    private deployment_options: any,
    private isToBreakBuildIfEmpty: boolean,
    private packageLogger?: Logger
  ) {}

  public async exec(): Promise<DeploySourceResult> {
    let commandExecStatus: boolean = false;
    let deploySourceResult = {} as DeploySourceResult;

    //Check empty conditions
    let status = PackageEmptyChecker.isToBreakBuildForEmptyDirectory(
      this.project_directory,
      this.source_directory,
      this.isToBreakBuildIfEmpty
    );
    if (status.result == "break") {
      deploySourceResult.result = false;
      deploySourceResult.message = status.message;
      return deploySourceResult;
    } else if (status.result == "skip") {
      deploySourceResult.result = true;
      deploySourceResult.message = "skip:" + status.message;
      return deploySourceResult;
    } else {
      SFPLogger.log(
        "Converting source to mdapi",
        LoggerLevel.DEBUG,
        this.packageLogger,
      );

      this.mdapiDir = await new ConvertSourceToMDAPIImpl(
        this.project_directory,
        this.source_directory,
        this.packageLogger
      ).exec(true);
      PackageMetadataPrinter.printMetadataToDeploy(
        (await PackageManifest.create(this.mdapiDir)).manifestJson,
        this.packageLogger
      );

      //Get Deploy ID
      let deploy_id = "";
      try {
        let command = this.buildExecCommand();
        SFPLogger.log("Executing Command:" + command, null, this.packageLogger);
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
        SFPLogger.log(
          `Validation only deployment  is in progress....  Unleashing the power of your code!`,
          null,
          this.packageLogger
        );
      else
        SFPLogger.log(
          `Deployment is in progress....  Unleashing the power of your code!`,
          null,
          this.packageLogger
        );

      // Loop till deployment completes to show status
      let result;
      while (true) {
        try {
          result = child_process.execSync(
            `sfdx force:mdapi:deploy:report --json -i ${deploy_id} -u ${this.target_org}`,
            {
              cwd: this.project_directory,
              encoding: "utf8",
              stdio: ["pipe", "pipe", "ignore"],
              maxBuffer: 5*1024*1024
            }
          );
        } catch (err) {
          if (this.deployment_options["checkonly"])
            SFPLogger.log(`Validation Failed`, LoggerLevel.ERROR, this.packageLogger);
          else SFPLogger.log(`Deployment Failed`, LoggerLevel.ERROR, this.packageLogger);
          break;
        }

        let resultAsJSON = JSON.parse(result);
        if (resultAsJSON["status"] == 1) {
          SFPLogger.log(
            "Deployment Failed",
            LoggerLevel.ERROR,
            this.packageLogger
          );
          commandExecStatus = false;
          break;
        } else if (
          resultAsJSON["result"]["status"] == "InProgress" ||
          resultAsJSON["result"]["status"] == "Pending"
        ) {
          SFPLogger.log(
            `${COLOR_TRACE(`Processing ${resultAsJSON.result.numberComponentsDeployed} out of ${resultAsJSON.result.numberComponentsTotal}`)}`,
            LoggerLevel.INFO,
            this.packageLogger
          );
        } else if (resultAsJSON["result"]["status"] == "Succeeded") {
          SFPLogger.log(
            COLOR_SUCCESS("Deployment Succeeded"),
            LoggerLevel.INFO,
            this.packageLogger
          );
          commandExecStatus = true;
          break;
        }

        await delay(30000);
      }

      deploySourceResult.message = await this.getFinalDeploymentStatus(
        deploy_id
      );
      deploySourceResult.result = commandExecStatus;
      deploySourceResult.deploy_id = deploy_id;
      return deploySourceResult;
    }
  }

  private async getFinalDeploymentStatus(deploy_id: string): Promise<string> {
    SFPLogger.log(`Gathering Final Deployment Status`, null, this.packageLogger);
    let reportAsJSON="";
    let deploymentReports =`.sfpowerscripts/mdapiDeployReports`;
    fs.mkdirpSync(deploymentReports);

    try {
      let child = child_process.exec(
        `sfdx force:mdapi:deploy:report --json -i ${deploy_id} -u ${this.target_org} -w 30`,
        {
          cwd: this.project_directory,
          encoding: "utf8",
          maxBuffer: 5*1024*1024
        }
      );

      child.stdout.on("data", (data) => {
        reportAsJSON += data.toString();
      });


      await onExit(child);

      return "Succesfully Deployed";
    } catch (err) {

      let report=JSON.parse(reportAsJSON);

      if(report.result.details.componentFailures && report.result.details.componentFailures.length>0)
      {
        DeployErrorDisplayer.printMetadataFailedToDeploy(
          report.result.details.componentFailures,this.packageLogger
        );
        return report.message;
      }
      else if(report.result.details.runTestResult)
      {
        if (report.result.details.runTestResult.codeCoverageWarnings) {
          this.displayCodeCoverageWarnings(report.result.details.runTestResult.codeCoverageWarnings);
        }

        if (report.result.details.runTestResult.failures?.length > 0) {
          this.displayTestFailures(report.result.details.runTestResult.failures);
        }
        return "Unable to deploy due to unsatisfactory code coverage and/or test failures";
      }
      else
      {
        return "Unable to fetch report";
      }
    } finally {
      // Write deployment report to file
      fs.writeFileSync(
        path.join(deploymentReports, `${deploy_id}.json`),
        reportAsJSON
      )
    }
  }

  private displayCodeCoverageWarnings(coverageWarnings: any) {
    let table = new Table({
      head: ["Name", "Message"],
    });
    if (Array.isArray(coverageWarnings)) {
      coverageWarnings.forEach(element => {
        table.push([element.name, element.message]);
      });
    }
    else {
      table.push([coverageWarnings.name, coverageWarnings.message]);
    }
    SFPLogger.log("Unable to deploy due to unsatisfactory code coverage, Check the following classes:", LoggerLevel.WARN, this.packageLogger);
    SFPLogger.log(table.toString(), LoggerLevel.WARN, this.packageLogger);
  }

  private displayTestFailures(testFailures) {
    let table = new Table({
      head: ["Test Name", "Method Name", "Message"],
    });

    testFailures.forEach(elem => {
      table.push([elem.name, elem.methodName, elem.message]);
    });

    SFPLogger.log("Unable to deploy due to test failures:", LoggerLevel.WARN, this.packageLogger);
    SFPLogger.log(table.toString(), LoggerLevel.WARN, this.packageLogger);
  }

  private buildExecCommand(): string {
    let apexclasses;

    let command = `sfdx force:mdapi:deploy -u ${this.target_org} --soapdeploy`;

    if (this.deployment_options["checkonly"]) command += ` -c`;

    //directory
    command += ` -d ${this.mdapiDir}`;

    //add json
    command += ` --json`;

    if (this.deployment_options["testlevel"] == "RunApexTestSuite") {
      //testlevel
      command += ` -l RunSpecifiedTests`;
      apexclasses = this.convertApexTestSuiteToListOfApexClasses(
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
    SFPLogger.log(
      `Converting an apex test suite  ${apextestsuite} to its consituent apex test classes`,
      null,
      this.packageLogger
    );

    let result = child_process.execSync(
      `sfdx sfpowerkit:source:apextestsuite:convert  -n ${apextestsuite} --json`,
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
