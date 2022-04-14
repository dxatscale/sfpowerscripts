import SFPLogger, { COLOR_WARNING, Logger } from '../../logger/SFPLogger';
import IndividualClassCoverage from '../../apex/coverage/IndividualClassCoverage';
import SFPPackage from '../SFPPackage';
import { Connection } from '@salesforce/core';
import ApexClassFetcher from '../../apex/ApexClassFetcher';
import ApexCodeCoverageAggregateFetcher from '../../apex/coverage/ApexCodeCoverageAggregateFetcher';
import ApexTriggerFetcher from '../../apex/ApexTriggerFetcher';

export default class PackageTestCoverage {
    private individualClassCoverage: IndividualClassCoverage;
    private packageTestCoverage: number = -1; // Set inital value

    public constructor(
        private pkg: SFPPackage,
        private codeCoverage: any,
        private logger: Logger,
        private readonly conn: Connection
    ) {
        this.individualClassCoverage = new IndividualClassCoverage(this.codeCoverage, this.logger);
    }

    public async getCurrentPackageTestCoverage(): Promise<number> {
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

        let listOfApexClassOrTriggerId: string[] = [];

        let classesNotTouchedByTestClass = this.getClassesNotTouchedByTestClass(packageClasses, this.codeCoverage);
        if (classesNotTouchedByTestClass.length > 0) {
            let apexClassIds = (
                await new ApexClassFetcher(this.conn).fetchApexClassByName(classesNotTouchedByTestClass)
            ).map((apexClass) => apexClass.Id);
            listOfApexClassOrTriggerId = listOfApexClassOrTriggerId.concat(apexClassIds);
        }

        let triggersNotTouchedByTestClass = this.getTriggersNotTouchedByTestClass(triggers, this.codeCoverage);
        if (triggersNotTouchedByTestClass.length > 0) {
            let triggerIds = (
                await new ApexTriggerFetcher(this.conn).fetchApexTriggerByName(triggersNotTouchedByTestClass)
            ).map((trigger) => trigger.Id);
            listOfApexClassOrTriggerId = listOfApexClassOrTriggerId.concat(triggerIds);
        }

        if (listOfApexClassOrTriggerId.length > 0) {
            let recordsOfApexCodeCoverageAggregate = await new ApexCodeCoverageAggregateFetcher(
                this.conn
            ).fetchACCAById(listOfApexClassOrTriggerId);

            if (recordsOfApexCodeCoverageAggregate.length > 0) {
                let numLinesUncovered: number = 0; // aggregate number of unconvered lines for classes & triggers that are not touched by any test classes
                recordsOfApexCodeCoverageAggregate.forEach((record) => {
                    numLinesUncovered += record.NumLinesUncovered;
                });
                totalLines += numLinesUncovered;
            }
        }

        let testCoverage = Math.floor((totalCovered / totalLines) * 100);
        this.packageTestCoverage = testCoverage;
        return testCoverage;
    }

    public async validateTestCoverage(
        coverageThreshold?: number
    ): Promise<{
        result: boolean;
        message?: string;
        packageTestCoverage: number;
        classesCovered?: { name: string; coveredPercent: number }[];
        classesWithInvalidCoverage?: { name: string; coveredPercent: number }[];
    }> {
        if (this.packageTestCoverage == -1)
            //No Value available
            await this.getCurrentPackageTestCoverage();

        let classesCovered = this.getIndividualClassCoverageByPackage(this.codeCoverage);

        if (coverageThreshold == undefined || coverageThreshold < 75) {
            SFPLogger.log('Setting minimum coverage percentage to 75%.');
            coverageThreshold = 75;
        }

        if (this.pkg.packageType === 'Unlocked') {
            if (this.packageTestCoverage < coverageThreshold) {
                // Coverage inadequate, set result to false
                return {
                    result: false, // Had earlier Changed to warning in Apr-22, due to unstable coverage, now reverting 
                    packageTestCoverage: this.packageTestCoverage,
                    classesCovered: classesCovered,
                    message: `${COLOR_WARNING(
                        `The package has an overall coverage of ${this.packageTestCoverage}%, which does not meet the required overall coverage of ${coverageThreshold}%`
                    )}`,
                };
            } else {
                return {
                    result: true,
                    packageTestCoverage: this.packageTestCoverage,
                    classesCovered: classesCovered,
                    message: `Package overall coverage is greater than ${coverageThreshold}%`,
                };
            }
        } else if (this.pkg.packageType === 'Source') {
            SFPLogger.log("Package type is 'source'. Validating individual class coverage");

            let individualClassValidationResults = this.individualClassCoverage.validateIndividualClassCoverage(
                this.getIndividualClassCoverageByPackage(this.codeCoverage),
                coverageThreshold
            );

            if (individualClassValidationResults.result) {
                return {
                    result: true,
                    packageTestCoverage: this.packageTestCoverage,
                    classesCovered: classesCovered,
                    classesWithInvalidCoverage: individualClassValidationResults.classesWithInvalidCoverage,
                    message: `Individidual coverage of classes is greater than ${coverageThreshold}%`,
                };
            } else {
                return {
                    result: false,
                    packageTestCoverage: this.packageTestCoverage,
                    classesCovered: classesCovered,
                    classesWithInvalidCoverage: individualClassValidationResults.classesWithInvalidCoverage,
                    message: `There are classes that do not satisfy the minimum code coverage of ${coverageThreshold}%`,
                };
            }
        } else {
            throw new Error('Unhandled package type');
        }
    }

    private getIndividualClassCoverageByPackage(codeCoverageReport: any): { name: string; coveredPercent: number }[] {
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
            if (classCoverage['coveredPercent'] !== null) {
                individualClassCoverage.push({
                    name: classCoverage['name'],
                    coveredPercent: classCoverage['coveredPercent'],
                });
            }
        }

        let namesOfClassesWithoutTest: string[] = this.getClassesNotTouchedByTestClass(
            packageClasses,
            codeCoverageReport
        );

        if (namesOfClassesWithoutTest.length > 0) {
            let classesWithoutTest: {
                name: string;
                coveredPercent: number;
            }[] = namesOfClassesWithoutTest.map((className) => {
                return { name: className, coveredPercent: 0 };
            });
            individualClassCoverage = individualClassCoverage.concat(classesWithoutTest);
        }

        // Check for triggers with no test class
        let namesOfTriggersWithoutTest: string[] = this.getTriggersNotTouchedByTestClass(triggers, codeCoverageReport);

        if (namesOfTriggersWithoutTest.length > 0) {
            let triggersWithoutTest: {
                name: string;
                coveredPercent: number;
            }[] = namesOfTriggersWithoutTest.map((triggerName) => {
                return { name: triggerName, coveredPercent: 0 };
            });
            individualClassCoverage = individualClassCoverage.concat(triggersWithoutTest);
        }

        return individualClassCoverage;
    }

    /**
     * Returns names of triggers in the package that are not triggered by the execution of any test classes
     * Returns empty array if triggers is null or undefined
     * @param triggers
     * @param codeCoverageReport
     * @returns
     */
    private getTriggersNotTouchedByTestClass(triggers: string[], codeCoverageReport: any): string[] {
        if (triggers != null) {
            return triggers.filter((trigger) => {
                for (let classCoverage of codeCoverageReport) {
                    if (classCoverage['name'] === trigger) {
                        // Filter out triggers if accounted for in coverage json
                        return false;
                    }
                }
                return true;
            });
        } else return [];
    }

    /**
     * Returns name of classes in the package that are not touched by the execution of any test classes
     * Returns empty array if packageClasses is null or undefined
     * @param packageClasses
     * @param codeCoverageReport
     * @returns
     */
    private getClassesNotTouchedByTestClass(packageClasses: string[], codeCoverageReport: any): string[] {
        if (packageClasses != null) {
            return packageClasses.filter((packageClass) => {
                for (let classCoverage of codeCoverageReport) {
                    if (classCoverage['name'] === packageClass) {
                        // Filter out package class if accounted for in coverage json
                        return false;
                    }
                }
                return true;
            });
        } else return [];
    }

    /**
     * Filter code coverage to classes and triggers in the package
     * @param codeCoverage
     * @param packageClasses
     * @param triggers
     */
    private filterCodeCoverageToPackageClassesAndTriggers(codeCoverage, packageClasses: string[], triggers: string[]) {
        let filteredCodeCoverage = codeCoverage.filter((classCoverage) => {
            if (packageClasses != null) {
                for (let packageClass of packageClasses) {
                    if (packageClass === classCoverage['name']) return true;
                }
            }

            if (triggers != null) {
                for (let trigger of triggers) {
                    if (trigger === classCoverage['name']) {
                        return true;
                    }
                }
            }

            return false;
        });

        return filteredCodeCoverage;
    }
}
