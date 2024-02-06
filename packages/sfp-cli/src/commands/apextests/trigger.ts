import {
    RunAllTestsInOrg,
    RunApexTestSuitesOption,
    RunLocalTests,
    RunSpecifiedTestsOption,
    TestLevel,
    TestOptions,
    RunAllTestsInPackageOptions,
} from '../../core/apextest/TestOptions';
import TriggerApexTests from '../../core/apextest/TriggerApexTests';
import SfpCommand from '../../SfpCommand';
import { Messages } from '@salesforce/core';
import SfpPackage from '../../core/package/SfpPackage';

import { ConsoleLogger } from '@flxblio/sfp-logger';
import { CoverageOptions } from '../../core/apex/coverage/IndividualClassCoverage';
import SfpPackageBuilder from '../../core/package/SfpPackageBuilder';
import { PackageType } from '../../core/package/SfpPackage';
import { Flags } from '@oclif/core';
import { loglevel, orgApiVersionFlagSfdxStyle, requiredUserNameFlag } from '../../flags/sfdxflags';
const path = require('path');

// Initialize Messages with the current plugin directory
Messages.importMessagesDirectory(__dirname);

// Load the specific messages for this file. Messages from @salesforce/command, @salesforce/core,
// or any library that is using the messages framework can also be loaded this way.
const messages = Messages.loadMessages('@flxblio/sfp', 'trigger_apex_test');

export default class TriggerApexTest extends SfpCommand {
    public static description = messages.getMessage('commandDescription');

    public static examples = [
        `$ sfp apextests:trigger -u scratchorg -l RunLocalTests -s`,
        `$ sfp apextests:trigger -u scratchorg -l RunAllTestsInPackage -n <mypackage> -c`,
    ];

    public static flags = {
        loglevel,
        'apiversion': orgApiVersionFlagSfdxStyle,
        'targetusername': requiredUserNameFlag,
        testlevel: Flags.string({
            char: 'l',
            description: messages.getMessage('testLevelFlagDescription'),
            options: [
                'RunSpecifiedTests',
                'RunApexTestSuite',
                'RunLocalTests',
                'RunAllTestsInOrg',
                'RunAllTestsInPackage',
            ],
            default: 'RunLocalTests',
        }),
        package: Flags.string({
            char: 'n',
            description: messages.getMessage('packageFlagDescription'),
            required: false,
        }),
        validateindividualclasscoverage: Flags.boolean({
            char: 'c',
            description: messages.getMessage('validateIndividualClassCoverageFlagDescription'),
            default: false,
        }),
        validatepackagecoverage: Flags.boolean({
            description: messages.getMessage('validatePackageCoverageFlagDescription'),
            default: false,
        }),
        specifiedtests: Flags.string({
            description: messages.getMessage('specifiedTestsFlagDescription'),
        }),
        apextestsuite: Flags.string({
            description: messages.getMessage('apexTestSuiteFlagDescription'),
        }),
        coveragepercent: Flags.integer({
            char: 'p',
            description: messages.getMessage('coveragePercentFlagDescription'),
            default: 75,
        }),
        waittime: Flags.integer({
            char: 'w',
            description: messages.getMessage('waitTimeFlagDescription'),
            default: 60,
        }),
    };

    public async execute() {
        try {

            let testOptions: TestOptions;
            let coverageOptions: CoverageOptions;
            let outputdir = path.join('.testresults');

            if (this.flags.testlevel === TestLevel.RunAllTestsInOrg.toString()) {
                testOptions = new RunAllTestsInOrg(this.flags.waittime, outputdir, this.flags.synchronous);
            } else if (this.flags.testlevel === TestLevel.RunAllTestsInPackage.toString()) {
                if (this.flags.package === null) {
                    throw new Error('Package name must be specified when test level is RunAllTestsInPackage');
                }
                let pkg: SfpPackage = await SfpPackageBuilder.buildPackageFromProjectDirectory(
                    new ConsoleLogger(),
                    null,
                    this.flags.package,
                    {
                        overridePackageTypeWith: PackageType.Source,
                    }
                );
                testOptions = new RunAllTestsInPackageOptions(pkg, this.flags.waittime, outputdir);
            } else if (this.flags.testlevel === TestLevel.RunApexTestSuite.toString()) {
                testOptions = new RunApexTestSuitesOption(
                    this.flags.waittime,
                    outputdir,
                    this.flags.apextestsuite,
                    this.flags.synchronous
                );
            } else if (this.flags.testlevel === TestLevel.RunLocalTests.toString()) {
                testOptions = new RunLocalTests(this.flags.waittime, outputdir, this.flags.synchronous);
            } else if (this.flags.testlevel === TestLevel.RunSpecifiedTests.toString()) {
                testOptions = new RunSpecifiedTestsOption(
                    this.flags.waittime,
                    outputdir,
                    this.flags.specifiedtests,
                    this.flags.synchronous
                );
            } else {
                throw new Error('Unimplemented Option, please check the option');
            }

            if (
                (this.flags.validateindividualclasscoverage || this.flags.validatepackagecoverage) &&
                this.flags.testlevel !== TestLevel.RunAllTestsInPackage.toString()
            ) {
                throw new Error('Code coverage validation is only available for test level RunAllTestsInPackage');
            } else {
                coverageOptions = {
                    isPackageCoverageToBeValidated: this.flags.validatepackagecoverage,
                    isIndividualClassCoverageToBeValidated: this.flags.validateindividualclasscoverage,
                    coverageThreshold: this.flags.coveragepercent,
                };
            }


            const triggerApexTests: TriggerApexTests = new TriggerApexTests(
                this.flags.targetusername,
                testOptions,
                coverageOptions,
                null,
                null
            );
            let result = await triggerApexTests.exec();

            if (!result.result) {
                throw new Error(`Error: ${result.message}`);
            } else {
                console.log(`\n ${result.message ? result.message : ''}`);
            }
        } catch (err) {
            console.log('\n');
            console.error(err.message);
            process.exitCode = 1;
        }
    }
}
