import * as fs from "fs-extra";
import path = require("path");
import SFPPackage from "../../package/SFPPackage";
import TriggerApexTestImpl from "../../sfdxwrappers/TriggerApexTestImpl";
import {TestOptions} from "../../sfdxwrappers/TestOptions";
import IndividualClassCoverage, {
  CoverageOptions,
} from "../../package/IndividualClassCoverage";
import { TestReportDisplayer } from "./TestReportDisplayer";
import PackageTestCoverage from "../../package/PackageTestCoverage";
import SFPLogger from "../../utils/SFPLogger";
import { RunAllTestsInPackageOptions } from "./ExtendedTestOptions";

export default class TriggerApexTests {
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
    let triggerApexTestImpl: TriggerApexTestImpl = new TriggerApexTestImpl(
      this.target_org,
      this.project_directory,
      this.testOptions
    );

    SFPLogger.log(
      "Executing Command",
      triggerApexTestImpl.getGeneratedSFDXCommandWithParams(),
      this.fileLogger
    );
    await triggerApexTestImpl.exec(true);

    let id = this.getTestId();
    let testReport = this.getTestReport(id);
    let testReportDisplayer = new TestReportDisplayer(
      testReport,
      this.testOptions,
      this.fileLogger
    );

    if (testReport.summary.outcome == "Failed") {
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

      if (
        this.coverageOptions.isIndividualClassCoverageToBeValidated ||
        this.coverageOptions.isPackageCoverageToBeValidated
      ) {
        return {
          result: coverageResults.result,
          id: id,
          message: coverageResults.message,
        };
      } else {
        return {
          result: true,
          id: id,
          message: `Test execution succesfully completed`,
        };
      }
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
      let sfppackage: SFPPackage = await SFPPackage.buildPackageFromProjectConfig(
        this.project_directory,
        this.testOptions.pkg
      );

      let packageTestCoverage: PackageTestCoverage = new PackageTestCoverage(
        sfppackage,
        this.getCoverageReport()
      );

      return packageTestCoverage.validateTestCoverage(
        this.coverageOptions.coverageThreshold
      );
    } else {
      if (this.coverageOptions.isIndividualClassCoverageToBeValidated) {
        let coverageValidator: IndividualClassCoverage = new IndividualClassCoverage(
          this.getCoverageReport()
        );
        return coverageValidator.validateIndividualClassCoverage(
          coverageValidator.getIndividualClassCoverage(),
          this.coverageOptions.coverageThreshold
        );
      } else {
        let coverageValidator: IndividualClassCoverage = new IndividualClassCoverage(
          this.getCoverageReport()
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
    SFPLogger.log("test_id", test_id);
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
