import * as fs from 'fs-extra';
import path = require('path');
import {
    RunSpecifiedTestsOption,
    TestOptions,
    RunApexTestSuitesOption,
    RunLocalTests,
    RunAllTestsInOrg,
} from './TestOptions';
import IndividualClassCoverage, { CoverageOptions } from '../apex/coverage/IndividualClassCoverage';
import { TestReportDisplayer } from './TestReportDisplayer';
import PackageTestCoverage from '../package/coverage/PackageTestCoverage';
import SFPLogger, { LoggerLevel } from '../logger/SFPLogger';
import { RunAllTestsInPackageOptions } from './ExtendedTestOptions';
import SFPStatsSender from '../stats/SFPStatsSender';
import { Connection, Org } from '@salesforce/core';
import ClearCodeCoverage from './ClearCodeCoverage';
import { TestLevel, TestResult, TestRunIdResult, TestService, JUnitReporter } from '@salesforce/apex-node';
import { delay } from '../utils/Delay';
import { CliJsonFormat, JsonReporter } from './JSONReporter';

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
        let org = await Org.create({ aliasOrUsername: this.target_org });
        this.conn = org.getConnection();

        //Clear Code Coverage before triggering tests
        try {
            let clearCodeCoverage = new ClearCodeCoverage(org, this.fileLogger);
            await clearCodeCoverage.clear();
        } catch (error) {
            SFPLogger.log(
                `Ignoring error in clearing code coverage attributed to ${error}.`,
                LoggerLevel.DEBUG,
                this.fileLogger
            );
        }

        let startTime = Date.now();
        let testExecutionResult: boolean = false;
        let testsRan;
        let commandTime;

        try {
            const testService = new TestService(this.conn);

            //Translate Tests to test levels used by apex-node
            let translatedTestLevel: TestLevel;
            //Fetch tests passed in the testOptions
            let tests: string = null;
            let suites: string = null;
            if (this.testOptions instanceof RunSpecifiedTestsOption) {
                translatedTestLevel = TestLevel.RunSpecifiedTests;
                tests = (this.testOptions as RunSpecifiedTestsOption).specifiedTests;
            } else if (this.testOptions instanceof RunAllTestsInPackageOptions) {
                translatedTestLevel = TestLevel.RunSpecifiedTests;
                tests = (this.testOptions as RunAllTestsInPackageOptions).specifiedTests;
            } else if (this.testOptions instanceof RunApexTestSuitesOption) {
                translatedTestLevel = TestLevel.RunSpecifiedTests;
                suites = (this.testOptions as RunApexTestSuitesOption).suiteNames;
            } else if (this.testOptions instanceof RunLocalTests) translatedTestLevel = TestLevel.RunLocalTests;
            else if (this.testOptions instanceof RunAllTestsInOrg) translatedTestLevel = TestLevel.RunAllTestsInOrg;

            //Trigger tests asynchronously
            let testRunIdResult = (await this.triggerTestAsynchronously(
                testService,
                translatedTestLevel,
                tests,
                suites
            )) as TestRunIdResult;

            //Print Test Id
            SFPLogger.log(
                `Triggered tests with Run Id: ${testRunIdResult.testRunId}`,
                LoggerLevel.INFO,
                this.fileLogger
            );

            //Poll for tests completion
            while (true) {
                let runStatus = await this.checkRunStatus(testRunIdResult.testRunId);
                SFPLogger.log(
                    `Executed Tests ... ${runStatus.ClassesCompleted} of ${runStatus.ClassesEnqueued}`,
                    LoggerLevel.INFO,
                    this.fileLogger
                );
                if (runStatus.Status == `Completed` || runStatus.Status == `Cancelled`) break;

                await delay(30000);
            }

            //Fetch Test Results
            const testResult = await testService.reportAsyncResults(testRunIdResult.testRunId, true);
            const jsonOutput = this.formatResultInJson(testResult);

            //write output files
            fs.ensureDirSync(this.testOptions.outputdir);

            //Write files
            fs.writeJSONSync(
                path.join(this.testOptions.outputdir, `test-result-${testRunIdResult.testRunId}.json`),
                jsonOutput,
                { spaces: 4 }
            );
            fs.writeJSONSync(
                path.join(this.testOptions.outputdir, `test-result-${testRunIdResult.testRunId}-coverage.json`),
                jsonOutput.coverage.coverage,
                { spaces: 4 }
            );

            //Write Junit Result no matter what
            SFPLogger.log(
                `Junit Report file available at ${path.join(
                    this.testOptions.outputdir,
                    `test-result-${testRunIdResult.testRunId}-junit.xml`
                )}`
            );
            let reportAsJUnitReport = new JUnitReporter().format(testResult);
            fs.writeFileSync(
                path.join(this.testOptions.outputdir, `test-result-${testRunIdResult.testRunId}-junit.xml`),
                reportAsJUnitReport
            );

            let testReportDisplayer = new TestReportDisplayer(jsonOutput, this.testOptions, this.fileLogger);

            commandTime = testResult.summary.commandTimeInMs;

            if (testResult.summary.outcome == 'Failed') {
                testExecutionResult = false;
                testReportDisplayer.printTestResults();

                return {
                    result: false,
                    id: testResult.summary.testRunId,
                    message: 'Test Execution failed',
                };
            } else {
                let coverageResults = await this.validateForApexCoverage(jsonOutput.coverage.coverage);
                testReportDisplayer.printTestResults();
                testReportDisplayer.printCoverageReport(
                    this.coverageOptions.coverageThreshold,
                    coverageResults.classesCovered,
                    coverageResults.classesWithInvalidCoverage
                );
                testReportDisplayer.printTestSummary(coverageResults.packageTestCoverage);
                testsRan = testResult.summary.testsRan;
                if (
                    this.coverageOptions.isIndividualClassCoverageToBeValidated ||
                    this.coverageOptions.isPackageCoverageToBeValidated
                ) {
                    testExecutionResult = coverageResults.result;
                    SFPStatsSender.logGauge('apextest.testcoverage', coverageResults.packageTestCoverage, {
                        package:
                            this.testOptions instanceof RunAllTestsInPackageOptions
                                ? this.testOptions.sfppackage.package_name
                                : null,
                    });
                    return {
                        result: coverageResults.result,
                        id: testResult.summary.testRunId,
                        message: coverageResults.message,
                    };
                } else {
                    testExecutionResult = true;
                    SFPStatsSender.logGauge(
                        'apextest.testcoverage',
                        Number.parseInt(testResult.summary.testRunCoverage),
                        {
                            package:
                                this.testOptions instanceof RunAllTestsInPackageOptions
                                    ? this.testOptions.sfppackage.package_name
                                    : null,
                        }
                    );
                    return {
                        result: true,
                        id: testResult.summary.testRunId,
                        message: `Test execution succesfully completed`,
                    };
                }
            }
        } finally {
            let elapsedTime = Date.now() - startTime;

            if (testExecutionResult)
                SFPStatsSender.logGauge('apextest.tests.ran', testsRan, {
                    test_result: String(testExecutionResult),
                    package:
                        this.testOptions instanceof RunAllTestsInPackageOptions
                            ? this.testOptions.sfppackage.package_name
                            : null,
                    type: this.testOptions.testLevel,
                    target_org: this.target_org,
                });

            SFPStatsSender.logGauge('apextest.testtotal.time', elapsedTime, {
                test_result: String(testExecutionResult),
                package:
                    this.testOptions instanceof RunAllTestsInPackageOptions
                        ? this.testOptions.sfppackage.package_name
                        : null,
                type: this.testOptions['testlevel'],
                target_org: this.target_org,
            });

            if (commandTime)
                SFPStatsSender.logGauge('apextest.command.time', commandTime, {
                    test_result: String(testExecutionResult),
                    package:
                        this.testOptions instanceof RunAllTestsInPackageOptions
                            ? this.testOptions.sfppackage.package_name
                            : null,
                    type: this.testOptions.testLevel,
                    target_org: this.target_org,
                });

            SFPStatsSender.logCount('apextests.triggered', {
                test_result: String(testExecutionResult),
                package:
                    this.testOptions instanceof RunAllTestsInPackageOptions
                        ? this.testOptions.sfppackage.package_name
                        : null,
                type: this.testOptions.testLevel,
                target_org: this.target_org,
            });
        }
    }

    private formatResultInJson(result: TestResult): CliJsonFormat {
        const reporter = new JsonReporter();
        return reporter.format(result);
    }

    private async triggerTestSynchronously(testService: TestService, testMethod: string): Promise<TestResult> {
        const payload = await testService.buildSyncPayload(TestLevel.RunSpecifiedTests, testMethod, null);
        payload.skipCodeCoverage = false;
        let result = (await testService.runTestSynchronous(payload, true, null)) as TestResult;
        return result;
    }
    /**
     * Trigger tests asynchronously
     * @param  {TestService} testService
     * @param  {TestLevel} testLevel
     * @param  {string} tests?
     * @param  {string} suites?
     */
    private async triggerTestAsynchronously(
        testService: TestService,
        testLevel: TestLevel,
        tests?: string,
        suites?: string
    ) {
        const payload = await testService.buildAsyncPayload(testLevel, null, tests, suites);

        let result = await testService.runTestAsynchronous(payload, true, true, undefined, null);

        return result;
    }

    public async checkRunStatus(testRunId: string): Promise<any | undefined> {
        let testRunSummaryQuery = 'SELECT AsyncApexJobId, Status, ClassesCompleted, ClassesEnqueued, ';
        testRunSummaryQuery += 'MethodsEnqueued, StartTime, EndTime, TestTime, UserId ';
        testRunSummaryQuery += `FROM ApexTestRunResult WHERE AsyncApexJobId = '${testRunId}'`;

        const testRunSummaryResults = (await this.conn.tooling.autoFetchQuery(testRunSummaryQuery)) as any;

        if (testRunSummaryResults.records.length === 0) {
            throw new Error(`0 liengt`);
        }

        return testRunSummaryResults.records[0];
    }

    private async validateForApexCoverage(coverageReport: any): Promise<{
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
                coverageReport,
                this.fileLogger,
                this.conn
            );

            return packageTestCoverage.validateTestCoverage(this.coverageOptions.coverageThreshold);
        } else {
            if (this.coverageOptions.isIndividualClassCoverageToBeValidated) {
                let coverageValidator: IndividualClassCoverage = new IndividualClassCoverage(
                    coverageReport,
                    this.fileLogger
                );
                return coverageValidator.validateIndividualClassCoverage(
                    coverageValidator.getIndividualClassCoverage(),
                    this.coverageOptions.coverageThreshold
                );
            } else {
                let coverageValidator: IndividualClassCoverage = new IndividualClassCoverage(
                    coverageReport,
                    this.fileLogger
                );
                return coverageValidator.validateIndividualClassCoverage(
                    coverageValidator.getIndividualClassCoverage()
                );
            }
        }
    }
}
