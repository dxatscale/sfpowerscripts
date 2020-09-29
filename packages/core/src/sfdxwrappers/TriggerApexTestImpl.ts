import child_process = require("child_process");
import { onExit } from "../utils/OnExit";
import { isNullOrUndefined } from "util";
import fs = require("fs-extra");
import path = require("path");
import MDAPIPackageGenerator from "../generators/MDAPIPackageGenerator";
const glob = require("glob");
import TestClassFetcher from "../parser/TestClassFetcher";
import InterfaceFetcher from "../parser/InterfaceFetcher";
import ManifestHelpers from "../manifest/ManifestHelpers";

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

    // Check code coverage of package classes that have test classes
    for (let classCoverage of code_coverage_json) {
      if (
        classCoverage["coveredPercent"] !== null &&
        classCoverage["coveredPercent"] < this.test_options["coverageThreshold"]
      ) {
        classesWithInvalidCoverage.push(classCoverage["name"]);
      }
    }

    // Check for package classes with no test class
    let classesWithoutTest: string[] = packageClasses.filter( (packageClass) => {
      // Filter out package class if accounted for in coverage json
      for (let classCoverage of code_coverage_json) {
        if (classCoverage["name"] === packageClass) {
          return false;
        }
      }
      return true;
    });


    if (classesWithoutTest.length > 0) {
      classesWithInvalidCoverage = classesWithInvalidCoverage.concat(classesWithoutTest);
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

    let packageDescriptor = ManifestHelpers.getSFDXPackageDescriptor(
      this.project_directory,
      this.test_options["packageToValidate"]
    );

    let packageDirectory: string = packageDescriptor["path"];

    let mdapiPackage = await MDAPIPackageGenerator.getMDAPIPackageFromSourceDirectory(
      this.project_directory,
      packageDirectory
    );


    for (let type of mdapiPackage.manifest["Package"]["types"]) {
      if (type["name"] == "ApexClass") {
        packageClasses = type["members"];
        break;
      }
    }

    // Remove test classes from package classes
    // if (fs.existsSync(path.join(mdapiPackage.mdapiDir, `classes`)))
    let testClassFetcher: TestClassFetcher = new TestClassFetcher();
    let testClasses: string[] = testClassFetcher.getTestClassNames(path.join(mdapiPackage.mdapiDir, `classes`));
    if (testClasses.length > 0) {
      // Filter out test classes
      packageClasses = packageClasses.filter( (packageClass) => {
        for (let testClass of testClasses) {
          if (testClass === packageClass) {
            return false;
          }
        }

        if (testClassFetcher.unparsedClasses.length > 0) {
          // Filter out undetermined classes that failed to parse
          for (let unparsedClass of testClassFetcher.unparsedClasses) {
            if (unparsedClass === packageClass) {
              console.log(`Skipping coverage validation for ${packageClass}, unable to determine identity of class`);
              return false;
            }
          }
        }

        return true;
      });
    }

    // Remove interfaces from package classes
    let interfaceFetcher: InterfaceFetcher = new InterfaceFetcher();
    let interfaceNames: string[] = interfaceFetcher.getInterfaceNames(path.join(mdapiPackage.mdapiDir, `classes`));
    if (interfaceNames.length > 0) {
      // Filter out interfaces
      packageClasses = packageClasses.filter( (packageClass) => {
        for (let interfaceName of interfaceNames) {
          if (interfaceName === packageClass) {
            return false;
          }
        }

        if (interfaceFetcher.unparsedClasses.length > 0) {
          // Filter out undetermined classes that failed to parse
          for (let unparsedClass of interfaceFetcher.unparsedClasses) {
            if (unparsedClass === packageClass) {
              console.log(`Skipping coverage validation for ${packageClass}, unable to determine identity of class`);
              return false;
            }
          }
        }

        return true;
      });
    }

    return packageClasses;
  }
}
