import TriggerApexTestImpl from '@dxatscale/sfpowerscripts.core/lib/sfdxwrappers/TriggerApexTestImpl';
import { flags, SfdxCommand } from '@salesforce/command';
import { Messages } from '@salesforce/core';
const path = require("path");
import { isNullOrUndefined } from "util";

// Initialize Messages with the current plugin directory
Messages.importMessagesDirectory(__dirname);

// Load the specific messages for this file. Messages from @salesforce/command, @salesforce/core,
// or any library that is using the messages framework can also be loaded this way.
const messages = Messages.loadMessages('@dxatscale/sfpowerscripts', 'trigger_apex_test');

export default class TriggerApexTest extends SfdxCommand {

  public static description = messages.getMessage('commandDescription');

  public static examples = [
  `sfdx sfpowerscripts:TriggerApexTest -u scratchorg -l RunLocalTests -s`,
  `sfdx sfpowerscripts:TriggerApexTest -u scratchorg -l RunApexTestSuite --apextestsuite <test_suite>`,
  `sfdx sfpowerscripts:TriggerApexTest -u scratchorg -l RunApexTestSuite --apextestsuite <test_suite> -c -t <package>`
  ];


  protected static flagsConfig = {
   targetorg: flags.string({char: 'u', description: messages.getMessage('targetOrgFlagDescription'), default: 'scratchorg'}),
   testlevel: flags.string({char: 'l', description: messages.getMessage('testLevelFlagDescription'), options: ['RunSpecifiedTests', 'RunApexTestSuite', 'RunLocalTests', 'RunAllTestsInOrg'], default: 'RunLocalTests'}),
   synchronous: flags.boolean({char: 's', description: messages.getMessage('synchronousFlagDescription')}),
   specifiedtests: flags.string({description: messages.getMessage('specifiedTestsFlagDescription')}),
   apextestsuite: flags.string({description: messages.getMessage('apexTestSuiteFlagDescription')}),
   validateindividualclasscoverage: flags.boolean({char: 'c', description: messages.getMessage('validateIndividualClassCoverageFlagDescription'), default: false}),
   coveragepercent: flags.integer({char: 'p', description: messages.getMessage('coveragePercentFlagDescription'), default: 75}),
   packagetovalidate: flags.string({char: 't', description: messages.getMessage('packageToValidateFlagDescription')}),
   waittime: flags.string({description: messages.getMessage('waitTimeFlagDescription'), default: '60'})
  };


  protected static requiresUsername = false;
  protected static requiresDevhubUsername = false;

  public async run(){
    try {
      let test_options = {};
      test_options["wait_time"] = this.flags.waittime;
      test_options["testlevel"] = this.flags.testlevel;
      test_options["synchronous"] = this.flags.synchronous;
      test_options["isValidateCoverage"] = this.flags.validateindividualclasscoverage;
      test_options["coverageThreshold"] = this.flags.coveragepercent;
      test_options["packageToValidate"] = this.flags.packagetovalidate;

      if (test_options["isValidateCoverage"]) {
        if (
          test_options["testlevel"] == "RunLocalTests" ||
          test_options["testlevel"] == "RunAllTestsInOrg"
        ) {
          throw new Error("Individual class coverage validation is only supported for RunApexTestSuite & RunSpecifiedTests");
        }
        else if (
          isNullOrUndefined(test_options["packageToValidate"])
        ) {
          throw new Error("Package to validate must be specified when validating individual class coverage");
        }
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
        this.flags.projectdir
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
      process.exit(1);
    }
  }
}
