import {
  RunApexTestSuitesOption,
  TestOptions,
} from "../../sfdxwrappers/TriggerApexTestImpl";
import { RunAllTestsInPackageOptions } from "./TriggerApexTest";

const Table = require("cli-table");

export class TestReportDisplayer {
  constructor(private apexTestReport: any, private testOptions: TestOptions) {}

  public printTestSummary(packageCoverage?: number): string {
    let apexTestReport = { ...this.apexTestReport };
    console.log("\n\n\n=== Test Summary");
    let table = new Table({
      head: ["Name", "Value"],
    });

    if (
      this.testOptions instanceof RunAllTestsInPackageOptions ||
      this.testOptions instanceof RunApexTestSuitesOption ||
      this.testOptions instanceof RunAllTestsInPackageOptions
    ) {
      delete apexTestReport.summary.summary.testRunCoverage;
      delete apexTestReport.summary.summary.orgWideCoverage;

      if (this.testOptions instanceof RunAllTestsInPackageOptions)
        apexTestReport.summary.packageCoverage = packageCoverage;
    }

    Object.entries<string | number>(apexTestReport.summary).forEach(
      (keyValuePair) => {
        keyValuePair[1] = keyValuePair[1] || "";
        table.push(keyValuePair);
      }
    );

    console.log(table.toString());
    return table.toString();
  }

  public printTestResults(): string {
    console.log("=== Test Results");

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

    console.log(table.toString());
    return table.toString();
  }

  public printCoverageReport(
    coverageThreshold: number,
    classesCovered: { name: string; coveredPercent: number }[],
    classesWithInvalidCoverage?: { name: string; coveredPercent: number }[]
  ): { classesCoveredTable: string; classInvalidCoverageTable?: string } {
    let classesCoveredTable = this.printIndividualClassCoverage(classesCovered);
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
    console.log(
      `The following classes do not satisfy the ${coverageThreshold}% code coverage requirement:`
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
      table.push([cls.name || "", cls.coveredPercent || ""]);
    });

    console.log(table.toString());
    return table.toString();
  }
}
