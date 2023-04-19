import TriggerApexTestImpl from '@dxatscale/sfpowerscripts.core/lib/apextest/TriggerApexTests';
import {
    RunAllTestsInPackageOptions,
    RunAllTestsInOrg,
    RunApexTestSuitesOption,
    RunLocalTests,
    RunSpecifiedTestsOption,
    TestLevel,
    TestOptions,
} from '@dxatscale/sfpowerscripts.core/lib/apextest/TestOptions';
import { CoverageOptions } from '@dxatscale/sfpowerscripts.core/lib/apex/coverage/IndividualClassCoverage';
import SfpPackage, { ApexClasses } from '@dxatscale/sfpowerscripts.core/lib/package/SfpPackage';
import PackageTestCoverage from '@dxatscale/sfpowerscripts.core/lib/package/coverage/PackageTestCoverage';
import { LoggerLevel, Org } from '@salesforce/core';
import SFPLogger, { ConsoleLogger } from '@dxatscale/sfp-logger/lib/SFPLogger';
import * as fs from 'fs-extra';
const path = require('path');
import SfpPackageBuilder from '@dxatscale/sfpowerscripts.core/lib/package/SfpPackageBuilder';

export default class TriggerApexTest {
    constructor(
        private targetOrg: string,
        private testLevel: TestLevel | 'RunAggregatedTests',
        private specifiedTests: string,
        private apexTestSuite: string,
        private isSynchronous: boolean,
        private waitTime: number,
        private packages: string[],
        private isValidatePackageCoverage: boolean,
        private isValidateIndividualClassCoverage: boolean,
        private coveragePercent: number
    ) {}

    async exec() {
        let testOptions: TestOptions;
        let coverageOptions: CoverageOptions;
        let outputdir = path.join('.testresults');
        const sfpPackages: SfpPackage[] = [];

        if (this.testLevel === TestLevel.RunAllTestsInOrg.toString()) {
            testOptions = new RunAllTestsInOrg(this.waitTime, outputdir, this.isSynchronous);
        } else if (this.testLevel === TestLevel.RunAllTestsInPackage.toString()) {
            if (this.packages == null || this.packages[0] == null) {
                throw new Error('Package name must be specified when test level is RunAllTestsInPackage');
            }
            let pkg: SfpPackage = await SfpPackageBuilder.buildPackageFromProjectDirectory(
                new ConsoleLogger(),
                null,
                this.packages[0]
            );
            testOptions = new RunAllTestsInPackageOptions(pkg, this.waitTime, outputdir);
        } else if (this.testLevel === 'RunAggregatedTests') {
            if (this.packages == null || this.packages.length === 0) {
                throw new Error('At least one package is required to run aggregated Apex tests');
            }

            const logLevelBackup = SFPLogger.logLevel;
            SFPLogger.logLevel = LoggerLevel.WARN; // Ignore INFO logs from SfpPackage factory method

            let apexTestClasses: ApexClasses = [];
            // aggregate test classes across packages
            for (const pkg of this.packages) {
                const sfpPackage: SfpPackage = await SfpPackageBuilder.buildPackageFromProjectDirectory(
                    new ConsoleLogger(),
                    null,
                    pkg
                );
                sfpPackages.push(sfpPackage);

                apexTestClasses = apexTestClasses.concat(sfpPackage.apexTestClassses);
            }

            SFPLogger.logLevel = logLevelBackup;

            if (apexTestClasses.length > 0) {
                testOptions = new RunSpecifiedTestsOption(this.waitTime, outputdir, apexTestClasses.toString());
            } else {
                throw new Error('No test classes found in package/s');
            }
        } else if (this.testLevel === TestLevel.RunApexTestSuite.toString()) {
            testOptions = new RunApexTestSuitesOption(
                this.waitTime,
                outputdir,
                this.apexTestSuite,
                null,
                this.isSynchronous
            );
        } else if (this.testLevel === TestLevel.RunLocalTests.toString()) {
            testOptions = new RunLocalTests(this.waitTime, outputdir, this.isSynchronous);
        } else if (this.testLevel === TestLevel.RunSpecifiedTests.toString()) {
            testOptions = new RunSpecifiedTestsOption(
                this.waitTime,
                outputdir,
                this.specifiedTests,
                this.isSynchronous
            );
        } else {
            throw new Error('Unimplemented Option, please check the option');
        }

        if (
            (this.isValidateIndividualClassCoverage || this.isValidatePackageCoverage) &&
            this.testLevel !== TestLevel.RunAllTestsInPackage.toString()
        ) {
            throw new Error('Code coverage validation is only available for test level RunAllTestsInPackage');
        } else {
            coverageOptions = {
                isPackageCoverageToBeValidated: this.isValidatePackageCoverage,
                isIndividualClassCoverageToBeValidated: this.isValidateIndividualClassCoverage,
                coverageThreshold: this.coveragePercent,
            };
        }

        const triggerApexTests = new TriggerApexTestImpl(this.targetOrg, testOptions, coverageOptions, null, null);
        let result = await triggerApexTests.exec();

        if (!result.result) {
            throw new Error(`Error: ${result.message}`);
        } else {
            console.log(`\n ${result.message ? result.message : ''}`);
        }

        let isCoverageFailure: boolean = false;
        if (this.testLevel === 'RunAggregatedTests') {
            // Validate code coverage for packages
            const conn = (await Org.create({ aliasOrUsername: this.targetOrg })).getConnection();

            const logLevelBackup = SFPLogger.logLevel;
            SFPLogger.logLevel = LoggerLevel.WARN; // Ignore INFO logs from PackageTestCoverage

            for (const sfpPackage of sfpPackages) {
                const packageTestCoverage = new PackageTestCoverage(
                    sfpPackage,
                    this.getCoverageReport(outputdir),
                    new ConsoleLogger(),
                    conn
                );
                let result = await packageTestCoverage.validateTestCoverage(this.coveragePercent);

                if (!result.result) {
                    isCoverageFailure = true;
                    console.log(
                        `${sfpPackage.packageName} package does not meet coverage requirements. ${result.message}`
                    );
                }
            }

            SFPLogger.logLevel = logLevelBackup;

            if (isCoverageFailure) {
                throw new Error(`Package coverage does not meet requirements`);
            }
        }
    }

    private getCoverageReport(outputDir: string): any {
        let testCoverageJSON = fs.readFileSync(path.join(outputDir, 'test-result-codecoverage.json')).toString();

        return JSON.parse(testCoverageJSON);
    }
}
