import SFPLogger from "../../logger/SFPLogger";
import IndividualClassCoverage from "../../coverage/IndividualClassCoverage";
import  SFPPackage  from "../SFPPackage";

export default class PackageTestCoverage {
  private individualClassCoverage: IndividualClassCoverage;
  private packageTestCoverage: number=-1 // Set inital value

  public constructor(
    private pkg: SFPPackage,
    private codeCoverage: any
  ) {
    this.individualClassCoverage = new IndividualClassCoverage(
      this.codeCoverage
    );
  }

  public getCurrentPackageTestCoverage(): number {
    let packageClasses: string[] = this.pkg.apexClassWithOutTestClasses;
    let triggers: string[] = this.pkg.triggers;

    let filteredCodeCoverage = this.filterCodeCoverageToPackageClassesAndTriggers(
      this.codeCoverage,
      packageClasses,
      triggers
    );

    let totalLines: number = 0;
    let totalCovered: number = 0;
    for (let classCoverage of filteredCodeCoverage) {
      if (classCoverage.coveredPercent !== null) {
        totalLines += classCoverage.totalLines;
        totalCovered += classCoverage.totalCovered;
      }
    }
    let testCoverage = Math.floor((totalCovered / totalLines) * 100);
    this.packageTestCoverage=testCoverage;
    return testCoverage;
  }

  public validateTestCoverage(
      coverageThreshold?:number
  ): {
    result: boolean;
    message?: string;
    packageTestCoverage: number;
    classesCovered?: { name: string; coveredPercent: number }[];
    classesWithInvalidCoverage?: { name: string; coveredPercent: number }[];
  } {
    if(this.packageTestCoverage==-1)  //No Value available
      this.getCurrentPackageTestCoverage();

    let classesCovered = this.getIndividualClassCoverageByPackage(
      this.codeCoverage
    );

    if (coverageThreshold == undefined || coverageThreshold < 75) {
      SFPLogger.log("Setting minimum coverage percentage to 75%.");
      coverageThreshold = 75;
    }

    if (this.pkg.packageType === "Unlocked") {
      if (this.packageTestCoverage < coverageThreshold) {
        // Coverage inadequate, set result to false
        return {
          result: false,
          packageTestCoverage: this.packageTestCoverage,
          classesCovered: classesCovered,
          message: `The package has an overall coverage of ${this.packageTestCoverage}%, which does not meet the required overall coverage of ${coverageThreshold}%`,
        };
      } else {
        return {
          result: true,
          packageTestCoverage: this.packageTestCoverage,
          classesCovered: classesCovered,
          message: `Package overall coverage is greater than ${coverageThreshold}%`,
        };
      }
    } else if (this.pkg.packageType === "Source") {
      SFPLogger.log(
        "Package type is 'source'. Validating individual class coverage"
      );

      let individualClassValidationResults = this.individualClassCoverage.validateIndividualClassCoverage(
        this.getIndividualClassCoverageByPackage(this.codeCoverage),
        coverageThreshold
      );

      if (individualClassValidationResults.result) {
        return {
          result: true,
          packageTestCoverage: this.packageTestCoverage,
          classesCovered: classesCovered,
          classesWithInvalidCoverage:
            individualClassValidationResults.classesWithInvalidCoverage,
          message: `Individidual coverage of classes is greater than ${coverageThreshold}%`,
        };
      } else {
        return {
          result: false,
          packageTestCoverage: this.packageTestCoverage,
          classesCovered: classesCovered,
          classesWithInvalidCoverage:
            individualClassValidationResults.classesWithInvalidCoverage,
          message: `There are classes that do not satisfy the minimum code coverage of ${coverageThreshold}%`,
        };
      }
    } else {
      throw new Error("Unhandled package type");
    }
  }

  private getIndividualClassCoverageByPackage(
    codeCoverageReport: any
  ): { name: string; coveredPercent: number }[] {
    let individualClassCoverage: {
      name: string;
      coveredPercent: number;
    }[] = [];

    let packageClasses: string[] = this.pkg.apexClassWithOutTestClasses;
    let triggers: string[] = this.pkg.triggers;

    codeCoverageReport = this.filterCodeCoverageToPackageClassesAndTriggers(
      codeCoverageReport,
      packageClasses,
      triggers
    );

    for (let classCoverage of codeCoverageReport) {
      if (classCoverage["coveredPercent"] !== null) {
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
        for (let classCoverage of codeCoverageReport) {
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
        for (let classCoverage of codeCoverageReport) {
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
}
