import child_process = require("child_process");
import { onExit } from "../OnExit";
import { fail } from "assert";
import { isNullOrUndefined } from "util";
let fs = require("fs-extra");
let path = require("path");

export default class TriggerApexTestImpl {
  public constructor(
    private target_org: string,
    private test_options: any,
  ) {}

  public async exec(): Promise<{
    id: string;
    result: boolean;
    message: string;
  }> {


    let test_result: { id: string; result: boolean; message: string } = {
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

    }


    try {
      let test_id = fs
        .readFileSync(
          path.join(this.test_options["outputdir"], "test-run-id.txt")
        )
        .toString();

      console.log('test_id',test_id);

      let test_report_json_file = fs
        .readFileSync(
          path.join(
            this.test_options["outputdir"],
            `test-result-${test_id}.json`
          )
        )
        .toString();

      let test_report_json = JSON.parse(test_report_json_file);

      test_result.id = test_id;



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
        console.error(output);
      } else {
        const classesWithInvalidCoverage: string[] = [];

        if (this.test_options["isValidateCoverage"]) {
          let code_coverage = fs.readFileSync(
            path.join(
              this.test_options["outputdir"],
              `test-result-codecoverage.json`
            ),
            "utf8"
          );
          let code_coverage_json = JSON.parse(code_coverage);

          for (let testClass of code_coverage_json) {
            if (testClass["coveredPercent"] < this.test_options["coverageThreshold"]) {
              classesWithInvalidCoverage.push(testClass["name"]);
            }
          }
        }

        if (classesWithInvalidCoverage.length == 0) {
          test_result.message = `${test_report_json.summary.passing} Tests passed with overall Test Run Coverage of ${test_report_json.summary.testRunCoverage}`;
          test_result.result = true;
        } else {
          test_result.message=`The test classes ${classesWithInvalidCoverage.toString()} do not meet the required code coverage of ${this.test_options["coverageThreshold"]}`;
          test_result.result = false;
        }
        console.log(output);
      }

      return test_result;
    } catch (err) {
      test_result.result = false;
      test_result.message = error;
      return test_result;
    }
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
}
