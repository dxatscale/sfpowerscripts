import child_process = require("child_process");
import { onExit } from "../utils/OnExit";
import fs = require("fs-extra");
import path = require("path");
import MDAPIPackageGenerator from "../generators/MDAPIPackageGenerator";
import ApexTypeFetcher, { ApexSortedByType } from "../parser/ApexTypeFetcher";
import ManifestHelpers from "../manifest/ManifestHelpers";
import SFPStatsSender from "../utils/SFPStatsSender";
const Table = require("cli-table");

export default class TriggerApexTestImpl {
  private mdapiPackage: { mdapiDir: string; manifest };
  private apexSortedByType: ApexSortedByType;
  private isValidateIndividualClassCoverageExecuted: boolean = false;

  public constructor(
    private target_org: string,
    private test_options: any,
    private project_directory: string
  ) {}

  public async exec(): Promise<{
    id: string;
    result: boolean;
    message: string;
  }> {
    let startTime = Date.now();

    const test_result: { id: string; result: boolean; message: string } = {
      id: "",
      result: false,
      message: "",
    };

    try {
      //Print final output
      let child = child_process.exec(await this.buildExecCommand(), {
        maxBuffer: 1024 * 1024 * 5,
        encoding: "utf8",
      });

      child.stderr.on(
        "data",
        data => console.log(data.toString())
      );

      await onExit(child);
    } catch (err) {
      //  Catch test failures

      console.log(err.message);

      if (
        err.message === "Package or package directory does not exist" ||
        err.message === "No test classes found in package"
      ) {
        // Terminate execution immediately if package does exist or package does not have test classes
        test_result.result = false;
        test_result.message = err.message;
        return test_result;
      }
    }

    let test_report;
    try {
      test_result.id = this.getTestId();

      test_report = this.getTestReport(test_result.id);

      let packageCoverage: number;
      if (this.test_options["testlevel"] === "RunAllTestsInPackage") {
        packageCoverage = this.calculatePackageCoverage();
      }

      this.printTestResults(test_report);
      this.printCoverageReport();
      this.printTestSummary(test_report, packageCoverage)

      test_result.message = `${test_report.summary.testsRan} Ran, with ${test_report.summary.passing} Tests passed and ${test_report.summary.failing} Tests failed\n`;
      if (test_report.summary.outcome == "Failed") {
        test_result.result = false;
      } else {
        // Tests passed, set result to true
        test_result.result = true;



        if (this.test_options.validatePackageCoverage) {
          let {result, message} = this.validatePackageCoverage(packageCoverage);
          test_result.result = result;
          test_result.message += message;

          if (result) {
            SFPStatsSender.logGauge("apextest.packagecoverage", packageCoverage,{
              package: this.test_options["package"]
            });
          }
        }

        if (this.test_options.validateIndividualClassCoverage && !this.isValidateIndividualClassCoverageExecuted) {
          test_result.result = this.validateIndividualClassCoverage();

          if (!test_result.result)
            test_result.message += `There are classes that do not satisfy the minimum code coverage of ${this.test_options["coverageThreshold"]}%.`;
          else
            test_result.message += `Individidual coverage of classes is greater than ${this.test_options.coverageThreshold}%. `
        }



        SFPStatsSender.logGauge("apextest.tests.ran",  test_report.summary.testsRan, {
          test_result: String(test_result.result),
          package: this.test_options["package"],
          type: this.test_options["testlevel"],
          target_org: this.target_org,
        });


        let testTotalTime = test_report.summary.testTotalTime.split(" ")[0];
        SFPStatsSender.logElapsedTime("apextest.testtotal.time", testTotalTime, {
          test_result: String(test_result.result),
          package: this.test_options["package"],
          type: this.test_options["testlevel"],
          target_org: this.target_org,
        });

        SFPStatsSender.logGauge("apextest.testcoverage", test_report.summary.testRunCoverage,{
          package: this.test_options["package"]
        });
      }

      return test_result;
    } catch (err) {
      test_result.result = false;
      test_result.message = err.message;

      return test_result;
    } finally {
      let elapsedTime = Date.now() - startTime;

      SFPStatsSender.logElapsedTime("apextest.command.time", elapsedTime, {
        test_result: String(test_result.result),
        package: this.test_options["package"],
        type: this.test_options["testlevel"],
        target_org: this.target_org,
      });
      SFPStatsSender.logCount("apextests.triggered", {
        test_result: String(test_result.result),
        package: this.test_options["package"],
        type: this.test_options["testlevel"],
        target_org: this.target_org,
      });

      // Delete test-run-id.txt, to prevent subsequent test runs from picking up old test results
      let testRunIdFilePath: string = path.join(this.test_options["outputdir"], "test-run-id.txt");
      if (fs.existsSync(testRunIdFilePath))
        fs.unlinkSync(testRunIdFilePath);
    }
  }


  private async buildExecCommand(): Promise<string> {
    let command = `npx sfdx force:apex:test:run -u ${this.target_org}`;

    if (this.test_options["synchronous"] == true) command += ` -y`;

    command += ` -c`;

    command += ` -r json`;
    //wait time
    command += ` -w  ${this.test_options["wait_time"]}`;

    //store result
    command += ` -d  ${this.test_options["outputdir"]}`;

    //testlevel
    // allowed options: RunLocalTests, RunAllTestsInOrg, RunSpecifiedTests, RunAllTestsInPackage
    if (this.test_options["testlevel"] !== "RunApexTestSuite") {
      if (this.test_options["testlevel"] === "RunAllTestsInPackage") {
        command += ` -l RunSpecifiedTests`;
      } else {
        command += ` -l ${this.test_options["testlevel"]}`;
      }
    }

    if (this.test_options["testlevel"] == "RunSpecifiedTests") {
      command += ` -t ${this.test_options["specified_tests"]}`;
    } else if (this.test_options["testlevel"] === "RunAllTestsInPackage") {
      // Get name of test classes in package directory

      let packageDescriptor = ManifestHelpers.getSFDXPackageDescriptor(
        this.project_directory,
        this.test_options["package"]
      );

      this.mdapiPackage = await MDAPIPackageGenerator.getMDAPIPackageFromSourceDirectory(
        this.project_directory,
        packageDescriptor["path"]
      );

      let apexTypeFetcher: ApexTypeFetcher = new ApexTypeFetcher();
      this.apexSortedByType = apexTypeFetcher.getApexTypeOfClsFiles(
        path.join(this.mdapiPackage.mdapiDir, `classes`)
      );

      if (this.apexSortedByType["parseError"].length > 0) {
        for (let parseError of this.apexSortedByType["parseError"]) {
          console.log(`Failed to parse ${parseError.name}`);
        }
      }

      let testClassNames: string[] = this.apexSortedByType["testClass"].map(
        (fileDescriptor) => fileDescriptor.name
      );

      if (testClassNames.length === 0) {
        throw new Error("No test classes found in package");
      }

      command += ` -t ${testClassNames.toString()}`;
    } else if (this.test_options["testlevel"] == "RunApexTestSuite") {
      command += ` -s ${this.test_options["apextestsuite"]}`;
    }

    console.log(`Generated Command: ${command}`);
    return command;
  }

  private getTestReport(testId: string) {
    let test_report_json = fs
      .readFileSync(
        path.join(
          this.test_options["outputdir"],
          `test-result-${testId}.json`
        )
      )
      .toString();


    return JSON.parse(test_report_json);
  }

  private getTestId(): string {
    let test_id = fs
      .readFileSync(
        path.join(this.test_options["outputdir"], "test-run-id.txt")
      )
      .toString();

      console.log("test_id", test_id);
    return test_id;
  }

  /**
   * Calculate the package coverage, also known as percentage lines covered
   */
  private calculatePackageCoverage(): number {
    let packageClasses: string[] = this.getClassesFromPackageManifest(
      this.mdapiPackage
    );
    let triggers: string[] = this.getTriggersFromPackageManifest(
      this.mdapiPackage
    );

    let code_coverage_json = fs.readFileSync(
      path.join(
        this.test_options["outputdir"],
        `test-result-codecoverage.json`
      ),
      "utf8"
    );

    let code_coverage = JSON.parse(code_coverage_json);
    code_coverage = this.filterCodeCoverageToPackageClassesAndTriggers(
      code_coverage,
      packageClasses,
      triggers
    );

    let totalLines: number = 0;
    let totalCovered: number = 0;
    for (let classCoverage of code_coverage) {
      if (classCoverage.coveredPercent !== null) {
        totalLines += classCoverage.totalLines;
        totalCovered += classCoverage.totalCovered;
      }
    }

    return Math.floor(totalCovered / totalLines * 100);
  }

  private validatePackageCoverage(packageCoverage: number): { result: boolean, message: string} {
    if (this.test_options.coverageThreshold < 75) {
      console.log("Setting minimum coverage percentage to 75%.");
      this.test_options.coverageThreshold = 75;
    }

    let projectConfig = ManifestHelpers.getSFDXPackageManifest(this.project_directory);
    let packageType = ManifestHelpers.getPackageType(projectConfig, this.test_options.package);
    if (packageType === "Unlocked") {
      if (packageCoverage < this.test_options.coverageThreshold) {
        // Coverage inadequate, set result to false
        return {
          result: false,
          message: `The package has an overall coverage of ${packageCoverage}%, which does not meet the required overall coverage of ${this.test_options.coverageThreshold}%.`
        };
      } else {
        return {
          result: true,
          message: `Package overall coverage is greater than ${this.test_options.coverageThreshold}%. `
        };
      }
    } else if (packageType === "Source") {
      this.isValidateIndividualClassCoverageExecuted = true;
      console.log("Package type is 'source'. Validating individual class coverage");
      if (this.validateIndividualClassCoverage()) {
        return {
          result: true,
          message: `Individidual coverage of classes is greater than ${this.test_options.coverageThreshold}%. `
        };
      } else {
        return {
          result: false,
          message: `There are classes that do not satisfy the minimum code coverage of ${this.test_options["coverageThreshold"]}%.`
        };
      }
    } else {
      throw new Error("Unhandled package type");
    }
  }

  private validateIndividualClassCoverage(): boolean {
    if (this.test_options.coverageThreshold < 75) {
      console.log("Setting minimum coverage percentage to 75%.");
      this.test_options.coverageThreshold = 75;
    }

    console.log(
      `Validating individual classes for code coverage greater than ${this.test_options.coverageThreshold} percent`
    );

    let individualClassCoverage = this.getIndividualClassCoverage();
    let classesWithInvalidCoverage = individualClassCoverage.filter( (cls) => {
      return cls.coveredPercent < this.test_options.coverageThreshold
    });

    if (classesWithInvalidCoverage.length > 0) {
      this.printClassesWithInvalidCoverage(classesWithInvalidCoverage);
      return false;
    } else
      return true;
  }

  private getIndividualClassCoverage(): {name: string, coveredPercent: number}[] {

    let individualClassCoverage: {
      name: string;
      coveredPercent: number;
    }[] = [];

    let code_coverage_json = fs.readFileSync(
      path.join(
        this.test_options["outputdir"],
        `test-result-codecoverage.json`
      ),
      "utf8"
    );
    let code_coverage = JSON.parse(code_coverage_json);

    if (this.test_options.testlevel === "RunAllTestsInPackage") {
      let packageClasses: string[] = this.getClassesFromPackageManifest(
        this.mdapiPackage
      );
      let triggers: string[] = this.getTriggersFromPackageManifest(
        this.mdapiPackage
      );

      code_coverage = this.filterCodeCoverageToPackageClassesAndTriggers(
        code_coverage,
        packageClasses,
        triggers
      );

      for (let classCoverage of code_coverage) {
        if (
          classCoverage["coveredPercent"] !== null
        ) {
          individualClassCoverage.push({
            name: classCoverage["name"],
            coveredPercent: classCoverage["coveredPercent"],
          });
        }
      }

      // Check for package classes with no test class
      let namesOfClassesWithoutTest: string[] = packageClasses.filter(
        (packageClass) => {
          // Filter out package class if accounted for in coverage json
          for (let classCoverage of code_coverage) {
            if (classCoverage["name"] === packageClass) {
              return false;
            }
          }
          return true;
        }
      );

      if (namesOfClassesWithoutTest.length > 0) {
        let classesWithoutTest: {
          name: string;
          coveredPercent: number;
        }[] = namesOfClassesWithoutTest.map((className) => {
          return { name: className, coveredPercent: 0 };
        });
        individualClassCoverage = individualClassCoverage.concat(
          classesWithoutTest
        );
      }

      if (triggers != null) {
        // Check for triggers with no test class
        let namesOfTriggersWithoutTest: string[] = triggers.filter((trigger) => {
          // Filter out triggers if accounted for in coverage json
          for (let classCoverage of code_coverage) {
            if (classCoverage["name"] === trigger) {
              return false;
            }
          }
          return true;
        });

        if (namesOfTriggersWithoutTest.length > 0) {
          let triggersWithoutTest: {
            name: string;
            coveredPercent: number;
          }[] = namesOfTriggersWithoutTest.map((triggerName) => {
            return { name: triggerName, coveredPercent: 0 };
          });
          individualClassCoverage = individualClassCoverage.concat(
            triggersWithoutTest
          );
        }
      }
    } else {
      // Return every class in coverage json if test level is not RunAllTestsInPackage
      individualClassCoverage = code_coverage.map( (cls) => {
        return {name: cls.name, coveredPercent: cls.coveredPercent}
      });
    }

    return individualClassCoverage;
  }

  /**
   * Filter code coverage to classes and triggers in the package
   * @param codeCoverage
   * @param packageClasses
   * @param triggers
   */
  private filterCodeCoverageToPackageClassesAndTriggers(
    codeCoverage,
    packageClasses: string[],
    triggers: string[]
  ) {
    let filteredCodeCoverage = codeCoverage.filter((classCoverage) => {
      if (packageClasses != null) {
        for (let packageClass of packageClasses) {
          if (packageClass === classCoverage["name"]) return true;
        }
      }

      if (triggers != null) {
        for (let trigger of triggers) {
          if (trigger === classCoverage["name"]) {
            return true;
          }
        }
      }

      return false;
    });

    return filteredCodeCoverage;
  }


  private getTriggersFromPackageManifest(mdapiPackage: {
    mdapiDir: string;
    manifest;
  }): string[] {
    let triggers: string[];

    let types;
    if (mdapiPackage.manifest["Package"]["types"] instanceof Array) {
      types = mdapiPackage.manifest["Package"]["types"];
    } else {
      // Create array with single type
      types = [mdapiPackage.manifest["Package"]["types"]];
    }

    for (let type of types) {
      if (type["name"] === "ApexTrigger") {
        if (type["members"] instanceof Array) {
          triggers = type["members"];
        } else {
          // Create array with single member
          triggers = [type["members"]];
        }
        break;
      }
    }

    return triggers;
  }

  private getClassesFromPackageManifest(mdapiPackage: {
    mdapiDir: string;
    manifest;
  }): string[] {
    let packageClasses: string[];

    let types;
    if (mdapiPackage.manifest["Package"]["types"] instanceof Array) {
      types = mdapiPackage.manifest["Package"]["types"];
    } else {
      // Create array with single type
      types = [mdapiPackage.manifest["Package"]["types"]];
    }

    for (let type of types) {
      if (type["name"] === "ApexClass") {
        if (type["members"] instanceof Array) {
          packageClasses = type["members"];
        } else {
          // Create array with single member
          packageClasses = [type["members"]];
        }
        break;
      }
    }

    if (packageClasses != null) {
      if (this.apexSortedByType["testClass"].length > 0) {
        // Filter out test classes
        packageClasses = packageClasses.filter((packageClass) => {
          for (let testClass of this.apexSortedByType["testClass"]) {
            if (testClass["name"] === packageClass) {
              return false;
            }
          }

          if (this.apexSortedByType["parseError"].length > 0) {
            // Filter out undetermined classes that failed to parse
            for (let parseError of this.apexSortedByType["parseError"]) {
              if (parseError["name"] === packageClass) {
                console.log(
                  `Skipping coverage validation for ${packageClass}, unable to determine identity of class`
                );
                return false;
              }
            }
          }

          return true;
        });
      }

      if (this.apexSortedByType["interface"].length > 0) {
        // Filter out interfaces
        packageClasses = packageClasses.filter((packageClass) => {
          for (let interfaceClass of this.apexSortedByType["interface"]) {
            if (interfaceClass["name"] === packageClass) {
              return false;
            }
          }
          return true;
        });
      }
    }

    return packageClasses;
  }
  private printCoverageReport() {
    let individualClassCoverage = this.getIndividualClassCoverage();
    this.printIndividualClassCoverage(individualClassCoverage);
  }

  private printTestSummary(testResult: any, packageCoverage: number){
    console.log("\n\n\n=== Test Summary");
    let table = new Table({
      head: ["Name", "Value"]
    });

    if (
      this.test_options.testlevel === "RunAllTestsInPackage" ||
      this.test_options.testlevel === "RunApexTestSuite" ||
      this.test_options.testlevel === "RunSpecifiedTests"
    ) {
      delete testResult.summary.testRunCoverage;
      delete testResult.summary.orgWideCoverage;

      if (this.test_options.testlevel === "RunAllTestsInPackage")
        testResult.summary.packageCoverage = packageCoverage;
    }

    Object.entries<string|number>(testResult.summary).forEach( (keyValuePair) => {
      keyValuePair[1] = keyValuePair[1] || "";
      table.push(keyValuePair);
    })

    console.log(table.toString());
  }

  private printTestResults(testResult: any) {
    console.log("=== Test Results");

    let table = new Table({
      head: ["Test Name", "Outcome", "Message", "Runtime (ms)"]
    });

    testResult.tests.forEach( (test) => {
      table.push([
        test.FullName || "",
        test.Outcome || "",
        test.Message || "",
        test.RunTime || ""
      ]);
    });

    console.log(table.toString());
  }

  private printClassesWithInvalidCoverage(
    classesWithInvalidCoverage: { name: string; coveredPercent: number }[]
  ) {
    console.log(
      `The following classes do not satisfy the ${this.test_options["coverageThreshold"]}% code coverage requirement:`
    );

    this.printIndividualClassCoverage(classesWithInvalidCoverage);
  }

  private printIndividualClassCoverage(
    individualClassCoverage: { name: string; coveredPercent: number }[]
  ) {
    let table = new Table({
      head: ["Class", "Coverage Percent"]
    });

    individualClassCoverage.forEach((cls) => {
      table.push([
        cls.name || "",
        cls.coveredPercent || "",
      ]);
    });

    console.log(table.toString());
  }
}
