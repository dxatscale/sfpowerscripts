import * as fs from "fs-extra";
import path = require("path");
import { ApexClasses, SFPPackage } from "../../package/SFPPackage";
import TriggerApexTestImpl, {
  RunSpecifiedTestsOption,
  TestOptions,
} from "../../sfdxwrappers/TriggerApexTestImpl";
import IndividualClassCoverage, {
  CoverageOptions,
} from "../../package/IndividualClassCoverage";
import { TestReportDisplayer } from "./TestReportDisplayer";
import PackageTestCoverage from "../../package/PackageTestCoverage";

export default class TriggerApexTests {
  public constructor(
    private target_org: string,
    private testOptions: TestOptions,
    private coverageOptions: CoverageOptions,
    private project_directory: string
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
    await triggerApexTestImpl.exec(true);

    let id = this.getTestId();
    let testReport = this.getTestReport(id);
    let testReportDisplayer = new TestReportDisplayer(
      testReport,
      this.testOptions
    );

    if (testReport.summary.outcome == "Failed") {
      testReportDisplayer.printTestResults();
      return {
        result: false,
        id: id,
        message: "Failed",
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
    }
  }

  private async validateForApexCoverage() {
    let coverageValidationResult;

    if (this.testOptions instanceof RunAllTestsInPackageOptions) {
      let sfppackage: SFPPackage = await SFPPackage.buildPackageFromProjectConfig(
        this.project_directory,
        this.testOptions.pkg
      );
      if (this.coverageOptions.isPackageCoverageToBeValidated) {
        let packageTestCoverage: PackageTestCoverage = new PackageTestCoverage(
          sfppackage,
          this.getCoverageReport
        );
        let coveragePercent = packageTestCoverage.getCurrentPackageTestCoverage();
        coverageValidationResult = packageTestCoverage.validateTestCoverage(
          this.coverageOptions.coverageThreshold
        );
      }
    } else {
      if (this.coverageOptions.isIndividualClassCoverageToBeValidated) {
        let coverageValidator: IndividualClassCoverage = new IndividualClassCoverage(
          this.getCoverageReport
        );
        coverageValidationResult = coverageValidator.validateIndividualClassCoverage(
          coverageValidator.getIndividualClassCoverage()
        );
      }
    }

    return coverageValidationResult;
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

    console.log("test_id", test_id);
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

export class RunAllTestsInPackageOptions extends RunSpecifiedTestsOption {
  public constructor(
    pkg: string,
    wait_time: number,
    outputdir: string,
    specifiedTests: ApexClasses
  ) {
    super(wait_time, outputdir, specifiedTests.toString(), pkg, false);
  }
}
