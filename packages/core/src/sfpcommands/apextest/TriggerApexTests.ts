import * as fs from "fs-extra";
import path = require("path");
import TriggerApexTestImpl from "../../sfdxwrappers/TriggerApexTestImpl";
import { TestOptions } from "../../sfdxwrappers/TestOptions";
import IndividualClassCoverage, {
  CoverageOptions,
} from "../../apex/coverage/IndividualClassCoverage";
import { TestReportDisplayer } from "./TestReportDisplayer";
import PackageTestCoverage from "../../package/coverage/PackageTestCoverage";
import SFPLogger, { LoggerLevel } from "../../logger/SFPLogger";
import { RunAllTestsInPackageOptions } from "./ExtendedTestOptions";
import SFPStatsSender from "../../stats/SFPStatsSender";
import { Connection, Org } from "@salesforce/core";

export default class TriggerApexTests {
  private conn: Connection;

  public constructor(
    private target_org: string,
    private testOptions: TestOptions,
    private coverageOptions: CoverageOptions,
    private project_directory: string,
    private fileLogger?: any
  ) {}

  public async exec(): Promise<{
    id: string;
    result: boolean;
    message: string;
  }> {
    this.cleanupStaleTestArtifacts();

    this.conn = (await Org.create({aliasOrUsername: this.target_org})).getConnection();

    let startTime = Date.now();
    let testExecutionResult: boolean = false;
    let testsRan;
    let commandTime;

    try {
      let triggerApexTestImpl: TriggerApexTestImpl = new TriggerApexTestImpl(
        this.target_org,
        this.project_directory,
        this.testOptions
      );

      SFPLogger.log(
        `Executing Command: ${triggerApexTestImpl.getGeneratedSFDXCommandWithParams()}`,
        LoggerLevel.INFO,
        this.fileLogger
      );

      let testExecErrorMsg: string;
      try {
        await triggerApexTestImpl.exec(true);
      } catch (err) {
        // catch error so that results can be displayed
        testExecErrorMsg = err.message;
      }

      let id: string;
      let testReport;
      try {
        id = this.getTestId();
        testReport = this.getTestReport(id);
      } catch (err) {
        // catch file parse error and replace with test exec error
        if (testExecErrorMsg)
          throw new Error(testExecErrorMsg);
        else
          throw err;
      }

      let testReportDisplayer = new TestReportDisplayer(
        testReport,
        this.testOptions,
        this.fileLogger
      );



      commandTime = testReport.summary.commandTime?.split(" ")[0];


      if (testReport.summary.outcome == "Failed") {
        testExecutionResult = false;
        testReportDisplayer.printTestResults();

        return {
          result: false,
          id: id,
          message: "Test Execution failed",
        };
      } else {
        let coverageResults = await this.validateForApexCoverage();
        testReportDisplayer.printTestResults();
        testReportDisplayer.printCoverageReport(
          this.coverageOptions.coverageThreshold,
          coverageResults.classesCovered,
          coverageResults.classesWithInvalidCoverage
        );
        testReportDisplayer.printTestSummary(coverageResults.packageTestCoverage);
        testsRan = testReport.summary.testsRan

        if (
          this.coverageOptions.isIndividualClassCoverageToBeValidated ||
          this.coverageOptions.isPackageCoverageToBeValidated
        ) {

          testExecutionResult = coverageResults.result;
          SFPStatsSender.logGauge("apextest.testcoverage", coverageResults.packageTestCoverage, {
            package: this.testOptions instanceof RunAllTestsInPackageOptions ? this.testOptions.sfppackage.package_name : null
          });

          return {
            result: coverageResults.result,
            id: id,
            message: coverageResults.message,
          };

        } else {
          testExecutionResult = true;
          SFPStatsSender.logGauge("apextest.testcoverage", testReport.summary.testRunCoverage, {
            package: this.testOptions instanceof RunAllTestsInPackageOptions ? this.testOptions.sfppackage.package_name : null
          });
          return {
            result: true,
            id: id,
            message: `Test execution succesfully completed`,
          };
        }
      }
    }
    finally {
      let elapsedTime = Date.now() - startTime;

      if (testExecutionResult)
        SFPStatsSender.logGauge("apextest.tests.ran", testsRan, {
          test_result: String(testExecutionResult),
          package: this.testOptions instanceof RunAllTestsInPackageOptions ? this.testOptions.sfppackage.package_name : null,
          type: this.testOptions.testLevel,
          target_org: this.target_org,
        });


      SFPStatsSender.logGauge("apextest.testtotal.time", elapsedTime, {
        test_result: String(testExecutionResult),
        package: this.testOptions instanceof RunAllTestsInPackageOptions ? this.testOptions.sfppackage.package_name : null,
        type: this.testOptions["testlevel"],
        target_org: this.target_org,
      });

      if(commandTime)
      SFPStatsSender.logGauge("apextest.command.time", commandTime, {
        test_result: String(testExecutionResult),
        package: this.testOptions instanceof RunAllTestsInPackageOptions ? this.testOptions.sfppackage.package_name : null,
        type: this.testOptions.testLevel,
        target_org: this.target_org,
      });

      SFPStatsSender.logCount("apextests.triggered", {
        test_result: String(testExecutionResult),
        package: this.testOptions instanceof RunAllTestsInPackageOptions ? this.testOptions.sfppackage.package_name : null,
        type: this.testOptions.testLevel,
        target_org: this.target_org,
      });

    }

  }

  private cleanupStaleTestArtifacts() {
    if (fs.existsSync(path.join(this.testOptions.outputdir, "test-run-id.txt"))) {
      // Delete test-run-id.txt to prevent misusage of results from previous test runs
      fs.unlinkSync(path.join(this.testOptions.outputdir, "test-run-id.txt"));
    }

    if (fs.existsSync(path.join(this.testOptions.outputdir, "test-result-codecoverage.json"))) {
      // Delete test-result-codecoverage.json to prevent misusage of results from previous test runs
      fs.unlinkSync(path.join(this.testOptions.outputdir, "test-result-codecoverage.json"));
    }
  }

  private async validateForApexCoverage(): Promise<{
    result: boolean;
    message?: string;
    packageTestCoverage?: number;
    classesCovered?: {
      name: string;
      coveredPercent: number;
    }[];
    classesWithInvalidCoverage?: {
      name: string;
      coveredPercent: number;
    }[];
  }> {
    if (this.testOptions instanceof RunAllTestsInPackageOptions) {

      let packageTestCoverage: PackageTestCoverage = new PackageTestCoverage(
        this.testOptions.sfppackage,
        this.getCoverageReport(),
        this.fileLogger,
        this.conn
      );

      return packageTestCoverage.validateTestCoverage(
        this.coverageOptions.coverageThreshold
      );
    } else {
      if (this.coverageOptions.isIndividualClassCoverageToBeValidated) {
        let coverageValidator: IndividualClassCoverage = new IndividualClassCoverage(
          this.getCoverageReport(),
          this.fileLogger
        );
        return coverageValidator.validateIndividualClassCoverage(
          coverageValidator.getIndividualClassCoverage(),
          this.coverageOptions.coverageThreshold
        );
      } else {
        let coverageValidator: IndividualClassCoverage = new IndividualClassCoverage(
          this.getCoverageReport(),
          this.fileLogger
        );
        return coverageValidator.validateIndividualClassCoverage(
          coverageValidator.getIndividualClassCoverage()
        );
      }
    }

  }

  private getTestReport(testId: string) {
    let test_report_json = fs
      .readFileSync(
        path.join(this.testOptions.outputdir, `test-result-${testId}.json`)
      )
      .toString();
    return JSON.parse(test_report_json);
  }

  private getTestId(): string {
    let test_id = fs
      .readFileSync(path.join(this.testOptions.outputdir, "test-run-id.txt"))
      .toString();
    SFPLogger.log(`test_id ${test_id}`);
    return test_id;
  }

  private getCoverageReport(): any {
    let testCoverageJSON = fs
      .readFileSync(
        path.join(this.testOptions.outputdir, "test-result-codecoverage.json")
      )
      .toString();

    return JSON.parse(testCoverageJSON);
  }
}
