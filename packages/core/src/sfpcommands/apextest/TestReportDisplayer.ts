import {
  RunApexTestSuitesOption,
  TestOptions,
} from "../../sfdxwrappers/TestOptions";
import SFPLogger, { LoggerLevel } from "../../logger/SFPLogger";
import { RunAllTestsInPackageOptions } from "./ExtendedTestOptions";

const Table = require("cli-table");

export class TestReportDisplayer {
  constructor(private apexTestReport: any, private testOptions: TestOptions, private fileLogger?:any) {}

  public printTestSummary(packageCoverage?: number): string {
    let apexTestReport = { ...this.apexTestReport };
    SFPLogger.log("\n\n\n=== Test Summary",LoggerLevel.INFO,this.fileLogger);
    let table = new Table({
      head: ["Name", "Value"],
    });

    if (
      this.testOptions instanceof RunAllTestsInPackageOptions ||
      this.testOptions instanceof RunApexTestSuitesOption ||
      this.testOptions instanceof RunAllTestsInPackageOptions
    ) {
      delete apexTestReport.summary.testRunCoverage;
      delete apexTestReport.summary.orgWideCoverage;

      if (this.testOptions instanceof RunAllTestsInPackageOptions)
        apexTestReport.summary.packageCoverage = packageCoverage;
    }

    Object.entries<string | number>(apexTestReport.summary).forEach(
      (keyValuePair) => {
        keyValuePair[1] = keyValuePair[1] || "";
        table.push(keyValuePair);
      }
    );

    SFPLogger.log(table.toString(),this.fileLogger);
    return table.toString();
  }

  public printTestResults(): string {
    SFPLogger.log("=== Test Results",LoggerLevel.INFO,this.fileLogger);

    let table = new Table({
      head: ["Test Name", "Outcome", "Message", "Runtime (ms)"],
    });

    this.apexTestReport.tests.forEach((test) => {
      table.push([
        test.FullName || "",
        test.Outcome || "",
        test.Message || "",
        test.RunTime || "",
      ]);
    });

    SFPLogger.log(table.toString(),LoggerLevel.INFO,this.fileLogger);
    return table.toString();
  }

  public printCoverageReport(
    coverageThreshold: number,
    classesCovered?: { name: string; coveredPercent: number }[],
    classesWithInvalidCoverage?: { name: string; coveredPercent: number }[]
  ): { classesCoveredTable: string; classInvalidCoverageTable?: string } {
    SFPLogger.log("\n\n=== Test Coverage",LoggerLevel.INFO,this.fileLogger);
    let classesCoveredTable
    if(classesCovered) {
     classesCoveredTable = this.printIndividualClassCoverage(classesCovered); }
    if (classesWithInvalidCoverage) {
      let classInvalidCoverageTable = this.printClassesWithInvalidCoverage(
        classesWithInvalidCoverage,
        coverageThreshold
      );
      return { classesCoveredTable, classInvalidCoverageTable };
    } else return { classesCoveredTable };
  }

  private printClassesWithInvalidCoverage(
    classesWithInvalidCoverage: { name: string; coveredPercent: number }[],
    coverageThreshold: number
  ): string {
    SFPLogger.log(
      `The following classes do not satisfy the ${coverageThreshold}% code coverage requirement:`,
      LoggerLevel.INFO,
      this.fileLogger
    );

    return this.printIndividualClassCoverage(classesWithInvalidCoverage);
  }

  private printIndividualClassCoverage(
    individualClassCoverage: { name: string; coveredPercent: number }[]
  ): string {
    let table = new Table({
      head: ["Class", "Coverage Percent"],
    });

    individualClassCoverage.forEach((cls) => {
      table.push([cls.name || "", cls.coveredPercent !== null ? cls.coveredPercent : "N/A"]);
    });

    SFPLogger.log(table.toString(),LoggerLevel.INFO,this.fileLogger);
    return table.toString();
  }
}
