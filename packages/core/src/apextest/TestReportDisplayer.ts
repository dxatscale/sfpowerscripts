import { RunAllTestsInPackageOptions, RunApexTestSuitesOption, TestOptions } from './TestOptions';
import SFPLogger, { COLOR_ERROR, COLOR_SUCCESS, LoggerLevel } from '@dxatscale/sfp-logger';
import { ZERO_BORDER_TABLE } from '../display/TableConstants';

const Table = require('cli-table');

export class TestReportDisplayer {
    constructor(private apexTestReport: any, private testOptions: TestOptions, private fileLogger?: any) {}

    public printTestSummary(packageCoverage?: number): string {
        let apexTestReport = { ...this.apexTestReport };
        SFPLogger.log('\n\n\n=== Test Summary', LoggerLevel.INFO, this.fileLogger);
        let table = new Table({
            head: ['Name', 'Value'],
            chars: ZERO_BORDER_TABLE
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

        Object.entries<string | number>(apexTestReport.summary).forEach((keyValuePair) => {
            keyValuePair[1] = keyValuePair[1] || '';
            table.push(keyValuePair);
        });

        SFPLogger.log(table.toString(), LoggerLevel.INFO, this.fileLogger);
        return table.toString();
    }

    public printTestResults(): string {
        SFPLogger.log('=== Test Results', LoggerLevel.INFO, this.fileLogger);

        let table = new Table({
            head: ['Test Name', 'Outcome', 'Message', 'Runtime (ms)'],
            chars: ZERO_BORDER_TABLE
        });

        this.apexTestReport.tests.forEach((test) => {
            if (test.Outcome === 'Pass') {
                table.push([
                    COLOR_SUCCESS(test.FullName || ''),
                    COLOR_SUCCESS(test.Outcome),
                    COLOR_SUCCESS(test.Message || ''),
                    COLOR_SUCCESS(test.RunTime || ''),
                ]);
            } else {
                table.push([
                    COLOR_ERROR(test.FullName || ''),
                    COLOR_ERROR(test.Outcome || ''),
                    COLOR_ERROR(test.Message || ''),
                    COLOR_ERROR(test.RunTime || ''),
                ]);
            }
        });

        SFPLogger.log(table.toString(), LoggerLevel.INFO, this.fileLogger);
        return table.toString();
    }

    public printCoverageReport(
        coverageThreshold: number,
        classesCovered?: { name: string; coveredPercent: number }[],
        classesWithInvalidCoverage?: { name: string; coveredPercent: number }[]
    ): { classesCoveredTable: string; classInvalidCoverageTable?: string } {
        SFPLogger.log('\n\n=== Test Coverage', LoggerLevel.INFO, this.fileLogger);
        let classesCoveredTable;
        if (classesCovered) {
            classesCoveredTable = this.printIndividualClassCoverage(classesCovered);
        }
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

    private printIndividualClassCoverage(individualClassCoverage: { name: string; coveredPercent: number }[]): string {
        let table = new Table({
            head: ['Class', 'Coverage Percent'],
            chars: ZERO_BORDER_TABLE
        });

        individualClassCoverage.forEach((cls) => {
            if (cls.coveredPercent !== null && cls.coveredPercent < 75) {
                table.push([COLOR_ERROR(cls.name || ''), COLOR_ERROR(cls.coveredPercent)]);
            } else if (cls.coveredPercent !== null && cls.coveredPercent >= 75) {
                table.push([COLOR_SUCCESS(cls.name || ''), COLOR_SUCCESS(cls.coveredPercent)]);
            } else table.push([cls.name || '', 'N/A']);
        });

        SFPLogger.log(table.toString(), LoggerLevel.INFO, this.fileLogger);
        return table.toString();
    }
}
