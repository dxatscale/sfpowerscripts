import TriggerApexTestImpl from '@dxatscale/sfpowerscripts.core/lib/sfdxwrappers/TriggerApexTestImpl';
import { flags, SfdxCommand } from '@salesforce/command';
import { Messages } from '@salesforce/core';
const path = require("path");
// Initialize Messages with the current plugin directory
Messages.importMessagesDirectory(__dirname);

// Load the specific messages for this file. Messages from @salesforce/command, @salesforce/core,
// or any library that is using the messages framework can also be loaded this way.
const messages = Messages.loadMessages('@dxatscale/sfpowerscripts', 'trigger_apex_test');

export default class TriggerApexTest extends SfdxCommand {

  public static description = messages.getMessage('commandDescription');

  public static examples = [
  `sfdx sfpowerscripts:TriggerApexTest -u scratchorg -l RunLocalTests -s
  `
  ];


  protected static flagsConfig = {
   targetorg: flags.string({char: 'u', description: messages.getMessage('targetOrgFlagDescription'), default: 'scratchorg'}),
   testlevel: flags.string({char: 'l', description: messages.getMessage('testLevelFlagDescription'), options: ['RunSpecifiedTests', 'RunApexTestSuite', 'RunLocalTests', 'RunAllTestsInOrg'], default: 'RunLocalTests'}),
   synchronous: flags.boolean({char: 's', description: messages.getMessage('synchronousFlagDescription')}),
   specifiedtests: flags.string({description: messages.getMessage('specifiedTestsFlagDescription')}),
   apextestsuite: flags.string({description: messages.getMessage('apexTestSuiteFlagDescription')}),
   validatecoverage: flags.boolean({char: 'c', description: messages.getMessage('validateCoverageFlagDescription')}),
   coveragepercent: flags.integer({char: 'p', description: messages.getMessage('coveragePercentFlagDescription'), dependsOn: ['validatecoverage'], default: 75}),
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
      test_options["isValidateCoverage"] = this.flags.validatecoverage;
      test_options["coverageThreshold"] = this.flags.coveragepercent;

      if (test_options["testlevel"] == "RunSpecifiedTests")
      test_options["specified_tests"] = this.flags.specifiedtests;
      if (test_options["testlevel"] == "RunApexTestSuite")
      test_options["apextestsuite"] = this.flags.apextestsuite;

      let stagingDir: string = path.join(".testresults");
      console.log(stagingDir);

      test_options["outputdir"] = stagingDir;

      const triggerApexTestImpl: TriggerApexTestImpl = new TriggerApexTestImpl(
        this.flags.targetorg,
        test_options
      );
      console.log("Executing command");
      let result = await triggerApexTestImpl.exec();

      if (!result.result) {
        throw new Error(`${result.message}`);
      } else {
        console.log(`${result.message}`);
      }
    } catch(err) {
      // AppInsights.trackExcepiton("sfpwowerscript-triggerapextest-task",err);
      console.error(err);
      // Fail the task when an error occurs
      process.exit(1);
    }
  }
}
