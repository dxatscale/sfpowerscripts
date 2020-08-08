import child_process = require("child_process");
import { onExit } from "../OnExit";
import { isNullOrUndefined } from "util";
let fs = require("fs-extra");
let path = require("path");
import getMDAPIPackageFromSourceDirectory from "../getMdapiPackage";

export default class TriggerApexTestImpl {
  public constructor(
    private target_org: string,
    private test_options: any,
    private project_directory: string,
  ) {}

  public async exec(): Promise<{
    id: string;
    result: boolean;
    message: string;
  }> {

    const test_result: { id: string; result: boolean; message: string } = {
      id: "",
      result: false,
      message: ""
    };

    let output = "";
    let error = ""
    try {
      //Print final output
      let child = child_process.exec(
        this.buildExecCommand(),
        {
          maxBuffer: 1024 * 1024 * 5,
          encoding: "utf8"
        },
        (error, stdout, stderr) => {}
      );

      child.stdout.on("data", data => {
        output += data.toString();
      });
      child.stderr.on("data", data => {
        error += data.toString();
      });

      await onExit(child);

    } catch (err) {

    } finally {
      console.log(output);
    }

    let test_report_json;
    try {
      let test_id = fs
        .readFileSync(
          path.join(this.test_options["outputdir"], "test-run-id.txt")
        )
        .toString();

      console.log('test_id',test_id);
      test_result.id = test_id;

      let test_report_json_file = fs
        .readFileSync(
          path.join(
            this.test_options["outputdir"],
            `test-result-${test_id}.json`
          )
        )
        .toString();

      test_report_json = JSON.parse(test_report_json_file);

      //Print human readable output to console
      if ((test_report_json.summary.outcome == "Failed")) {
        test_result.message = `${test_report_json.summary.failing} Tests failed with overall Test Run Coverage of ${test_report_json.summary.testRunCoverage}`;
        test_result.message += "\nFailed Test Cases:";

        test_report_json.tests.forEach(element => {
          if (element.Outcome == "Fail") {
            test_result.message += "\n"+ `${element.MethodName}  ${element.Message}    ${element.StackTrace}`;
          }
        });
        test_result.result = false;
        return test_result;
      }
    } catch (err) {
      test_result.result = false;
      test_result.message = error;
      return test_result;
    }

    let classesWithInvalidCoverage: string[];

    if (this.test_options["isValidateCoverage"]) {
      classesWithInvalidCoverage = await this.validateClassCodeCoverage();
    }

    if (isNullOrUndefined(classesWithInvalidCoverage) || classesWithInvalidCoverage.length == 0) {
      test_result.message = `${test_report_json.summary.passing} Tests passed with overall Test Run Coverage of ${test_report_json.summary.testRunCoverage} percent`;
      test_result.result = true;
    } else {
      test_result.message=`The classes ${classesWithInvalidCoverage.toString()} do not meet the required code coverage of ${this.test_options["coverageThreshold"]}`;
      test_result.result = false;
    }
    return test_result;
  }

  private buildExecCommand(): string {
    let command = `npx sfdx force:apex:test:run -u ${this.target_org}`;

    if (this.test_options["synchronous"] == true) command += ` -y`;

    command += ` -c`;

    command += ` -r human`;
    //wait time
    command += ` -w  ${this.test_options["wait_time"]}`;

    //store result
    command += ` -d  ${this.test_options["outputdir"]}`;

    //testlevel
    // allowed options: RunLocalTests, RunAllTestsInOrg, RunSpecifiedTests
    if (this.test_options["testlevel"] !== "RunApexTestSuite") {
      command += ` -l ${this.test_options["testlevel"]}`;
    }

    if (this.test_options["testlevel"] == "RunSpecifiedTests") {
      command += ` -t ${this.test_options["specified_tests"]}`;
    } else if (this.test_options["testlevel"] == "RunApexTestSuite") {
      command += ` -s ${this.test_options["apextestsuite"]}`;
    }

    console.log(`Generated Command: ${command}`);
    return command;
  }

  private async validateClassCodeCoverage(): Promise<string[]>  {
    console.log(`Validating individual classes for code coverage greater than ${this.test_options["coverageThreshold"]} percent`);
    let classesWithInvalidCoverage: string[] = [];

    let packageClasses: string[] = await this.getClassesFromPackageManifest();

    let code_coverage = fs.readFileSync(
      path.join(
        this.test_options["outputdir"],
        `test-result-codecoverage.json`
      ),
      "utf8"
    );

    let code_coverage_json = JSON.parse(code_coverage);
    code_coverage_json = this.filterCodeCoverageToPackageClasses(code_coverage_json, packageClasses);

    for (let classCoverage of code_coverage_json) {
      if (
        classCoverage["coveredPercent"] !== null &&
        classCoverage["coveredPercent"] < this.test_options["coverageThreshold"]
      ) {
        classesWithInvalidCoverage.push(classCoverage["name"]);
      }
    }
    return classesWithInvalidCoverage;
  }

  private filterCodeCoverageToPackageClasses(codeCoverage, packageClasses: string[]) {
    let filteredCodeCoverage = codeCoverage;
    if (!isNullOrUndefined(packageClasses)) {
      // only include package classes in code coverage report
      filteredCodeCoverage = codeCoverage.filter( (classCoverage) => {
        for (let packageClass of packageClasses) {
          if (packageClass == classCoverage["name"])
            return true;
        }
        return false;
      });
    }
    return filteredCodeCoverage;
  }

  private async getClassesFromPackageManifest(): Promise<string[]> {
    let packageClasses: string[];

    let packageDirectory: string = this.getPackageDirectory();

    let mdapiPackage = await getMDAPIPackageFromSourceDirectory(
      this.project_directory,
      packageDirectory
    );

    for (let type of mdapiPackage["manifestAsJSON"]["Package"]["types"]) {
      if (type["name"] == "ApexClass") {
        packageClasses = type["members"];
        break;
      }
    }
    return packageClasses;
  }

  private getPackageDirectory(): string {
    let packageDirectory: string;

    let projectConfig: string;
    if (!isNullOrUndefined(this.project_directory)) {
      projectConfig = path.join(
        this.project_directory,
        "sfdx-project.json"
      );
    } else {
      projectConfig = "sfdx-project.json";
    }

    let projectJson = JSON.parse(
      fs.readFileSync(projectConfig, "utf8")
    );

    projectJson["packageDirectories"].forEach( (pkg) => {
      if (this.test_options["packageToValidate"] == pkg["package"])
        packageDirectory = pkg["path"];
    });

    if (isNullOrUndefined(packageDirectory))
      throw new Error("Package or package directory to validate does not exist");
    else
      return packageDirectory;
  }
}
