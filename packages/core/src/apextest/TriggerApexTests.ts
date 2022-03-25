import * as fs from 'fs-extra';
import path = require('path');
import {
    RunSpecifiedTestsOption,
    TestOptions,
    RunApexTestSuitesOption,
    RunLocalTests,
    RunAllTestsInOrg,
    RunAllTestsInPackageOptions,
} from './TestOptions';
import IndividualClassCoverage, { CoverageOptions } from '../apex/coverage/IndividualClassCoverage';
import { TestReportDisplayer } from './TestReportDisplayer';
import PackageTestCoverage from '../package/coverage/PackageTestCoverage';
import SFPLogger, { COLOR_KEY_MESSAGE, Logger, LoggerLevel, COLOR_ERROR } from '../logger/SFPLogger';
import SFPStatsSender from '../stats/SFPStatsSender';
import { Connection, Org } from '@salesforce/core';
import {
    TestLevel,
    TestResult,
    TestService,
    JUnitReporter,
    Progress,
    ApexTestProgressValue,
    CancellationTokenSource,
    ApexTestResultOutcome,
} from '@salesforce/apex-node';
import { CliJsonFormat, JsonReporter } from './JSONReporter';
import { Duration } from '@salesforce/kit';
import { UpsertResult } from 'jsforce';
import ClearCodeCoverage from './ClearCodeCoverage';
import _ from 'lodash';
const retry = require('async-retry');

export default class TriggerApexTests {
    private conn: Connection;
    protected cancellationTokenSource = new CancellationTokenSource();

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

        // graceful shutdown
        const exitHandler = async (): Promise<void> => {
            await this.cancellationTokenSource.asyncCancel();
            process.exit();
        };

        process.on('SIGINT', exitHandler);
        process.on('SIGTERM', exitHandler);

        let startTime = Date.now();
        let testExecutionResult: boolean = false;
        let testsRan;
        let commandTime;

        try {
            const testService = new TestService(this.conn);

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

            //Translate Tests to test levels used by apex-node
            let translatedTestLevel: TestLevel;
            //Fetch tests passed in the testOptions
            let tests: string = null;
            let suites: string = null;
            if (this.testOptions instanceof RunAllTestsInPackageOptions) {
                SFPLogger.log(
                    `Test Mode Descriptor in Package 'testSynchronous': ${
                        this.testOptions.sfppackage.packageDescriptor.testSynchronous
                            ? this.testOptions.sfppackage.packageDescriptor.testSynchronous
                            : false
                    }`,
                    LoggerLevel.INFO,
                    this.fileLogger
                );
                SFPLogger.log(
                    `Test Mode: ${COLOR_KEY_MESSAGE(
                        this.testOptions.sfppackage.packageDescriptor.testSynchronous == true ? 'serial' : 'parallel'
                    )}`,
                    LoggerLevel.INFO,
                    this.fileLogger
                );
                await this.toggleParallelApexTesting(
                    this.conn,
                    this.fileLogger,
                    this.testOptions.sfppackage.packageDescriptor.testSynchronous == true ? true : false
                );
                translatedTestLevel = TestLevel.RunSpecifiedTests;
                tests = (this.testOptions as RunAllTestsInPackageOptions).specifiedTests;
                SFPLogger.log(`Tests to be executed: ${COLOR_KEY_MESSAGE(tests)}`, LoggerLevel.INFO, this.fileLogger);
            } else if (this.testOptions instanceof RunSpecifiedTestsOption) {
                translatedTestLevel = TestLevel.RunSpecifiedTests;
                tests = (this.testOptions as RunSpecifiedTestsOption).specifiedTests;
                SFPLogger.log(`Tests to be executed: ${COLOR_KEY_MESSAGE(tests)}`, LoggerLevel.INFO, this.fileLogger);
            } else if (this.testOptions instanceof RunApexTestSuitesOption) {
                translatedTestLevel = TestLevel.RunSpecifiedTests;
                suites = (this.testOptions as RunApexTestSuitesOption).suiteNames;
                SFPLogger.log(
                    `Test Suites to be executed: ${COLOR_KEY_MESSAGE(suites)}`,
                    LoggerLevel.INFO,
                    this.fileLogger
                );
            } else if (this.testOptions instanceof RunLocalTests) {
                translatedTestLevel = TestLevel.RunLocalTests;
                SFPLogger.log(
                    `Triggering all ${COLOR_KEY_MESSAGE(`local tests`)}in the org`,
                    LoggerLevel.INFO,
                    this.fileLogger
                );
            } else if (this.testOptions instanceof RunAllTestsInOrg) {
                SFPLogger.log(
                    `Triggering all ${COLOR_KEY_MESSAGE(`all tests`)}in the org`,
                    LoggerLevel.INFO,
                    this.fileLogger
                );
                translatedTestLevel = TestLevel.RunAllTestsInOrg;
            }
            //Trigger tests asynchronously
            let testRunResult: TestResult;
            try {
                testRunResult = (await this.triggerTestAsynchronously(
                    testService,
                    translatedTestLevel,
                    tests,
                    suites
                )) as TestResult;
            } catch (error) {
                return {
                    result: false,
                    id: null,
                    message: error.message,
                };
            }

            //Fetch Test Results
            let testResult = await testService.reportAsyncResults(
                testRunResult.summary.testRunId,
                true,
                this.cancellationTokenSource.token
            );

            this.writeTestOutput(testResult);
            //Collect Failed Tests only if Parallel
            testResult = await this.triggerSecondRunInSerialForParallelFailedTests(
                testResult,
                testService,
                translatedTestLevel
            );

            //Write Junit Result no matter what
            this.writeJUnit(testResult);

            let jsonOutput = this.writeTestOutput(testResult);
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

    private writeJUnit(testResult: TestResult) {
        SFPLogger.log(
            `Junit Report file available at ${path.join(
                this.testOptions.outputdir,
                `test-result-${testResult.summary.testRunId}-junit.xml`
            )}`
        );
        let reportAsJUnitReport = new JUnitReporter().format(testResult);
        fs.writeFileSync(
            path.join(this.testOptions.outputdir, `test-result-${testResult.summary.testRunId}-junit.xml`),
            reportAsJUnitReport
        );
    }

    private async triggerSecondRunInSerialForParallelFailedTests(
        testResult: TestResult,
        testService: TestService,
        translatedTestLevel: TestLevel
    ) {
        let modifiedTestResult = _.cloneDeep(testResult);
        if (
            this.testOptions instanceof RunAllTestsInPackageOptions &&
            !this.testOptions.sfppackage.packageDescriptor.testSynchronous
        ) {
            let parallelFailedTestClasses: string[] = [];
            let testClassesThatDonotContributedCoverage: string[] = [];

            let testToBeTriggered: string[] = [];
            for (const test of modifiedTestResult.tests) {
                if (test.outcome == ApexTestResultOutcome.Fail) {
                    //Check for messages
                    if (
                        test.message.includes(`Your request exceeded the time limit for processing`) ||
                        test.message.includes(`UNABLE_TO_LOCK_ROW`)
                    ) {
                        if (!testToBeTriggered.includes(test.apexClass.fullName)) {
                            parallelFailedTestClasses.push(test.apexClass.fullName);
                            testToBeTriggered.push(test.apexClass.fullName);
                        }
                    }
                }

                if (test.outcome == ApexTestResultOutcome.Pass) {
                    if (
                        !test.perClassCoverage &&
                        (this.coverageOptions.isPackageCoverageToBeValidated ||
                            this.coverageOptions.isIndividualClassCoverageToBeValidated)
                    ) {
                        if (!testToBeTriggered.includes(test.apexClass.fullName)) {
                            testClassesThatDonotContributedCoverage.push(test.apexClass.fullName);
                            if (!testToBeTriggered.includes(test.apexClass.fullName))
                                testToBeTriggered.push(test.apexClass.fullName);
                        }
                    }
                }
            }

            if (parallelFailedTestClasses.length > 0) {
                SFPLogger.log(
                    `Failed Tests while triggered in parallel: ${COLOR_KEY_MESSAGE(
                        parallelFailedTestClasses.toString()
                    )}`,
                    LoggerLevel.INFO,
                    this.fileLogger
                );
            }

            if (testClassesThatDonotContributedCoverage.length > 0) {
                SFPLogger.log(
                    `Test Classes that were not able to contribute coverage: ${COLOR_KEY_MESSAGE(
                        testClassesThatDonotContributedCoverage.toString()
                    )}`,
                    LoggerLevel.INFO,
                    this.fileLogger
                );
            }

            if (testToBeTriggered.length > 0) {
                SFPLogger.log(
                    `Triggering tests synchronously: ${COLOR_KEY_MESSAGE(testToBeTriggered.toString())}`,
                    LoggerLevel.INFO,
                    this.fileLogger
                );
                //Trigger Second Test Run
                //Convert to sequential
                await this.toggleParallelApexTesting(this.conn, this.fileLogger, true);

                //Trigger tests asynchronously
                let secondRuntestRunResult: TestResult;
                secondRuntestRunResult = await retry(
                    async (bail) => {
                        return (await this.triggerTestAsynchronously(
                            testService,
                            translatedTestLevel,
                            testToBeTriggered.toString(),
                            null
                        )) as TestResult;
                    },
                    { retries: 2, minTimeout: 3000 }
                );

                //Fetch Test Results
                const secondTestResult = await testService.reportAsyncResults(
                    secondRuntestRunResult.summary.testRunId,
                    true,
                    this.cancellationTokenSource.token
                );

                this.writeTestOutput(secondTestResult);

                //Replace original test result
                modifiedTestResult.tests = modifiedTestResult.tests.map(
                    (obj) => secondTestResult.tests.find((o) => o.methodName === obj.methodName) || obj
                );

                //Replace original code coverage
                modifiedTestResult.codecoverage = modifiedTestResult.codecoverage.map(
                    (obj) => secondTestResult.codecoverage.find((o) => o.name === obj.name) || obj
                );

                //Now redo the math
                modifiedTestResult.summary.failing = 0;
                modifiedTestResult.summary.passing = 0;
                modifiedTestResult.summary.skipped = 0;

                for (const test of modifiedTestResult.tests) {
                    if (test.outcome === ApexTestResultOutcome.Pass) modifiedTestResult.summary.passing++;
                    else if (test.outcome === ApexTestResultOutcome.Fail) modifiedTestResult.summary.failing++;
                    else if (test.outcome === ApexTestResultOutcome.Skip) modifiedTestResult.summary.skipped++;
                }

                if (modifiedTestResult.summary.failing > 0) modifiedTestResult.summary.outcome = 'Failed';
                else modifiedTestResult.summary.outcome = 'Passed';

                modifiedTestResult.summary.passRate =
                    (modifiedTestResult.summary.passing / modifiedTestResult.summary.testsRan) * 100 + '%';
                modifiedTestResult.summary.failRate =
                    (modifiedTestResult.summary.failing / modifiedTestResult.summary.testsRan) * 100 + '%';
                modifiedTestResult.summary.commandTimeInMs =
                    modifiedTestResult.summary.commandTimeInMs + secondRuntestRunResult.summary.commandTimeInMs;
                modifiedTestResult.summary.testExecutionTimeInMs =
                    modifiedTestResult.summary.testExecutionTimeInMs +
                    secondRuntestRunResult.summary.testExecutionTimeInMs;
                modifiedTestResult.summary.testTotalTimeInMs =
                    modifiedTestResult.summary.testTotalTimeInMs + secondRuntestRunResult.summary.testTotalTimeInMs;

                delete modifiedTestResult.summary.testRunCoverage;
                delete modifiedTestResult.summary.orgWideCoverage;
                delete modifiedTestResult.summary.totalLines;
                delete modifiedTestResult.summary.coveredLines;

                modifiedTestResult.summary.testRunId = modifiedTestResult.summary.testRunId.concat(
                    '_',
                    secondRuntestRunResult.summary.testRunId
                );
            }
        }

        return modifiedTestResult;
    }

    private writeTestOutput(testResult: TestResult): CliJsonFormat {
        const jsonOutput = this.formatResultInJson(testResult);

        //write output files
        fs.ensureDirSync(this.testOptions.outputdir);

        //Write files
        fs.writeJSONSync(
            path.join(this.testOptions.outputdir, `test-result-${testResult.summary.testRunId}.json`),
            testResult,
            { spaces: 4 }
        );
        fs.writeJSONSync(
            path.join(this.testOptions.outputdir, `test-result-${testResult.summary.testRunId}-coverage.json`),
            jsonOutput.coverage.coverage,
            { spaces: 4 }
        );

        return jsonOutput;
    }

    private formatResultInJson(result: TestResult): CliJsonFormat {
        try {
            const reporter = new JsonReporter();
            return reporter.format(result);
        } catch (error) {
            return null;
        }
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

        let result = await testService.runTestAsynchronous(
            payload,
            true,
            false,
            new ProgressReporter(this.fileLogger),
            this.cancellationTokenSource.token
        );

        if (this.cancellationTokenSource.token.isCancellationRequested) {
            throw new Error(`A previous run is being cancelled.. Please try after some time`);
        }

        return result;
    }

    private async validateForApexCoverage(
        coverageReport: any
    ): Promise<{
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
    //Enable Synchronus Compile on Deploy
    private async toggleParallelApexTesting(conn: Connection, logger: Logger, toEnable: boolean) {
        try {
            SFPLogger.log(`Set enableDisableParallelApexTesting:${toEnable}`, LoggerLevel.TRACE, logger);
            let apexSettingMetadata = { fullName: 'ApexSettings', enableDisableParallelApexTesting: toEnable };
            let result: UpsertResult | UpsertResult[] = await conn.metadata.upsert('ApexSettings', apexSettingMetadata);
            if ((result as UpsertResult).success) {
                SFPLogger.log(`Successfully updated apex testing setting`, LoggerLevel.INFO, logger);
            }
        } catch (error) {
            SFPLogger.log(
                `Skipping toggling of enableDisableParallelApexTesting due  to ${error}..`,
                LoggerLevel.INFO,
                logger
            );
        }
    }
}
export class ProgressReporter implements Progress<ApexTestProgressValue> {
    private lastExecutedTime;
    constructor(private logger: Logger) {
        this.lastExecutedTime = Date.now();
    }

    report(value: ApexTestProgressValue): void {
        try {
            let count = {};
            //Limit printing an update to 30 seconds
            if (Date.now() - this.lastExecutedTime > Duration.seconds(30).milliseconds) {
                if (value.type == 'TestQueueProgress') {
                    for (const elem of value.value.records) {
                        if (elem.Status) {
                            if (!count[elem.Status]) {
                                count[elem.Status] = 1;
                            } else count[elem.Status]++;
                        }
                    }
                    let statusString = '';

                    //Compute total
                    let total: number = 0;
                    for (const [key, value] of Object.entries(count)) {
                        total += value as number;
                    }
                    statusString = `Completed:${count['Completed'] ? count['Completed'] : 0}/${total} Queued(${
                        count['Queued'] ? count['Queued'] : 0
                    }) Failed(${COLOR_ERROR(count['Failed'] ? count['Failed'] : 0)})  `;
                    SFPLogger.log(`Test Status: ` + COLOR_KEY_MESSAGE(statusString), LoggerLevel.INFO, this.logger);
                    this.lastExecutedTime = Date.now();
                }
            }
        } catch (error) {
            //Ignore any results during reporting
        }
    }
}
