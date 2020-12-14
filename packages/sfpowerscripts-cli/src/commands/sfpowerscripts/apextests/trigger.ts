import TriggerApexTestImpl from '@dxatscale/sfpowerscripts.core/lib/sfdxwrappers/TriggerApexTestImpl';
import { flags } from '@salesforce/command';
import SfpowerscriptsCommand from '../../../SfpowerscriptsCommand';
import { Messages } from '@salesforce/core';
const path = require("path");

// Initialize Messages with the current plugin directory
Messages.importMessagesDirectory(__dirname);

// Load the specific messages for this file. Messages from @salesforce/command, @salesforce/core,
// or any library that is using the messages framework can also be loaded this way.
const messages = Messages.loadMessages('@dxatscale/sfpowerscripts', 'trigger_apex_test');

export default class TriggerApexTest extends SfpowerscriptsCommand {

  public static description = messages.getMessage('commandDescription');

  public static examples = [
    `$ sfdx sfpowerscripts:apextests:trigger -u scratchorg -l RunLocalTests -s`,
    `$ sfdx sfpowerscripts:apextests:trigger -u scratchorg -l RunAllTestsInPackage -n <mypackage> -c`
  ];


  protected static flagsConfig = {
    targetorg: flags.string({
      char: 'u',
      description: messages.getMessage('targetOrgFlagDescription'),
      default: 'scratchorg'
    }),
    testlevel: flags.string({
      char: 'l',
      description: messages.getMessage('testLevelFlagDescription'),
      options: ['RunSpecifiedTests', 'RunApexTestSuite', 'RunLocalTests', 'RunAllTestsInOrg', 'RunAllTestsInPackage'],
      default: 'RunLocalTests'
    }),
    package: flags.string({
      char: 'n',
      description: messages.getMessage('packageFlagDescription'),
      required: false
    }),
    validateindividualclasscoverage: flags.boolean({
      char: 'c',
      description: messages.getMessage('validateIndividualClassCoverageFlagDescription'),
      default: false
    }),
    validatepackagecoverage: flags.boolean({
      description: messages.getMessage('validatePackageCoverageFlagDescription'),
      default: false
    }),
    synchronous: flags.boolean({
      char: 's',
      description: messages.getMessage('synchronousFlagDescription')
    }),
    specifiedtests: flags.string({
      description: messages.getMessage('specifiedTestsFlagDescription')
    }),
    apextestsuite: flags.string({
      description: messages.getMessage('apexTestSuiteFlagDescription')
    }),
    coveragepercent: flags.integer({
      char: 'p',
      description: messages.getMessage('coveragePercentFlagDescription'),
      default: 75
    }),
    waittime: flags.string({
      description: messages.getMessage('waitTimeFlagDescription'),
      default: '60'
    })
  };


  protected static requiresUsername = false;
  protected static requiresDevhubUsername = false;

  public async execute(){
    try {



      let test_options = {};
      test_options["wait_time"] = this.flags.waittime;
      test_options["testlevel"] = this.flags.testlevel;
      test_options["package"] = this.flags.package;
      test_options["synchronous"] = this.flags.synchronous;
      test_options["validateIndividualClassCoverage"] = this.flags.validateindividualclasscoverage;
      test_options["validatePackageCoverage"] = this.flags.validatepackagecoverage;
      test_options["coverageThreshold"] = this.flags.coveragepercent;

      // Input validation
      if (
        test_options["testlevel"] === "RunAllTestsInPackage" &&
        test_options["package"] == null
      ) {
        throw new Error("Package name must be specified when test level is RunAllTestsInPackage")
      } else if (
        (test_options["validateIndividualClassCoverage"] || test_options["validatePackageCoverage"]) &&
        test_options["testlevel"] !== "RunAllTestsInPackage"
      ) {
        throw new Error("Code coverage validation is only available for test level RunAllTestsInPackage");
      }


      if (test_options["testlevel"] == "RunSpecifiedTests")
      test_options["specified_tests"] = this.flags.specifiedtests;
      if (test_options["testlevel"] == "RunApexTestSuite")
      test_options["apextestsuite"] = this.flags.apextestsuite;

      let stagingDir: string = path.join(".testresults");
      console.log(stagingDir);

      test_options["outputdir"] = stagingDir;

      const triggerApexTestImpl: TriggerApexTestImpl = new TriggerApexTestImpl(
        this.flags.targetorg,
        test_options,
        null
      );
      console.log("Executing command");
      let result = await triggerApexTestImpl.exec();

      if (!result.result) {
        throw new Error(`Error: ${result.message}`);
      } else {
        console.log(`${result.message}`);
      }


    } catch(err) {
      console.log("\n");
      console.error(err.message);
      process.exitCode=1;
    }
  }
}
