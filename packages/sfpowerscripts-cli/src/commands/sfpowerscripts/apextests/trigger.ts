import {
  RunAllTestsInOrg,
  RunApexTestSuitesOption,
  RunLocalTests,
  RunSpecifiedTestsOption,
  TestLevel,
  TestOptions,
} from "@dxatscale/sfpowerscripts.core/lib/sfdxwrappers/TestOptions";
import { ExtendedTestOptions,RunAllTestsInPackageOptions } from "@dxatscale/sfpowerscripts.core/lib/sfpcommands/apextest/ExtendedTestOptions"
import TriggerApexTests from "@dxatscale/sfpowerscripts.core/lib/sfpcommands/apextest/TriggerApexTests";
import { flags } from "@salesforce/command";
import SfpowerscriptsCommand from "../../../SfpowerscriptsCommand";
import { Messages } from "@salesforce/core";
import SFPPackage from "@dxatscale/sfpowerscripts.core/lib/package/SFPPackage";

import { ConsoleLogger } from "@dxatscale/sfpowerscripts.core/lib/logger/SFPLogger";
import { CoverageOptions } from "@dxatscale/sfpowerscripts.core/lib/apex/coverage/IndividualClassCoverage";
const path = require("path");


// Initialize Messages with the current plugin directory
Messages.importMessagesDirectory(__dirname);

// Load the specific messages for this file. Messages from @salesforce/command, @salesforce/core,
// or any library that is using the messages framework can also be loaded this way.
const messages = Messages.loadMessages(
  "@dxatscale/sfpowerscripts",
  "trigger_apex_test"
);

export default class TriggerApexTest extends SfpowerscriptsCommand {
  public static description = messages.getMessage("commandDescription");

  public static examples = [
    `$ sfdx sfpowerscripts:apextests:trigger -u scratchorg -l RunLocalTests -s`,
    `$ sfdx sfpowerscripts:apextests:trigger -u scratchorg -l RunAllTestsInPackage -n <mypackage> -c`,
  ];

  protected static flagsConfig = {
    testlevel: flags.string({
      char: "l",
      description: messages.getMessage("testLevelFlagDescription"),
      options: [
        "RunSpecifiedTests",
        "RunApexTestSuite",
        "RunLocalTests",
        "RunAllTestsInOrg",
        "RunAllTestsInPackage",
      ],
      default: "RunLocalTests",
    }),
    package: flags.string({
      char: "n",
      description: messages.getMessage("packageFlagDescription"),
      required: false,
    }),
    validateindividualclasscoverage: flags.boolean({
      char: "c",
      description: messages.getMessage(
        "validateIndividualClassCoverageFlagDescription"
      ),
      default: false,
    }),
    validatepackagecoverage: flags.boolean({
      description: messages.getMessage(
        "validatePackageCoverageFlagDescription"
      ),
      default: false,
    }),
    synchronous: flags.boolean({
      char: "s",
      description: messages.getMessage("synchronousFlagDescription"),
    }),
    specifiedtests: flags.string({
      description: messages.getMessage("specifiedTestsFlagDescription"),
    }),
    apextestsuite: flags.string({
      description: messages.getMessage("apexTestSuiteFlagDescription"),
    }),
    coveragepercent: flags.integer({
      char: "p",
      description: messages.getMessage("coveragePercentFlagDescription"),
      default: 75,
    }),
    waittime: flags.number({
      char:"w",
      description: messages.getMessage("waitTimeFlagDescription"),
      default: 60,
    }),
    loglevel: flags.enum({
      description: "logging level for this command invocation",
      default: "info",
      required: false,
      options: [
        "trace",
        "debug",
        "info",
        "warn",
        "error",
        "fatal",
        "TRACE",
        "DEBUG",
        "INFO",
        "WARN",
        "ERROR",
        "FATAL",
      ],
    })
  };

  protected static requiresUsername = true;
  protected static requiresDevhubUsername = false;

  public async execute() {
    try {
      let testOptions: TestOptions;
      let coverageOptions: CoverageOptions;
      let outputdir = path.join(".testresults");

      if (this.flags.testlevel === TestLevel.RunAllTestsInOrg.toString()) {
        testOptions = new RunAllTestsInOrg(
          this.flags.waittime,
          outputdir,
          this.flags.synchronous
        );
      } else if (
        this.flags.testlevel === ExtendedTestOptions.RunAllTestsInPackage.toString()
      ) {
        if (this.flags.package === null) {
          throw new Error(
            "Package name must be specified when test level is RunAllTestsInPackage"
          );
        }
        let pkg: SFPPackage = await SFPPackage.buildPackageFromProjectConfig(
          new ConsoleLogger(),
          null,
          this.flags.package
        );
        testOptions = new RunAllTestsInPackageOptions(
          pkg,
          this.flags.waittime,
          outputdir
        );
      } else if (
        this.flags.testlevel === TestLevel.RunApexTestSuite.toString()
      ) {
        testOptions = new RunApexTestSuitesOption(
          this.flags.waittime,
          outputdir,
          this.flags.apextestsuite,
          this.flags.synchronous
        );
      } else if (this.flags.testlevel === TestLevel.RunLocalTests.toString()) {
        testOptions = new RunLocalTests(
          this.flags.waittime,
          outputdir,
          this.flags.synchronous
        );
      } else if (
        this.flags.testlevel === TestLevel.RunSpecifiedTests.toString()
      ) {
        testOptions = new RunSpecifiedTestsOption(
          this.flags.waittime,
          outputdir,
          this.flags.specifiedtests,
          this.flags.synchronous
        );
      } else {
        throw new Error("Unimplemented Option, please check the option");
      }

      if (
        (this.flags.validateindividualclasscoverage ||
          this.flags.validatepackagecoverage) &&
        this.flags.testlevel !== ExtendedTestOptions.RunAllTestsInPackage.toString()
      ) {
        throw new Error(
          "Code coverage validation is only available for test level RunAllTestsInPackage"
        );
      } else {
        coverageOptions = {
          isPackageCoverageToBeValidated: this.flags.validatepackagecoverage,
          isIndividualClassCoverageToBeValidated: this.flags
            .validateindividualclasscoverage,
          coverageThreshold: this.flags.coveragepercent,
        };
      }


      const triggerApexTests: TriggerApexTests = new TriggerApexTests(this.org.getUsername(),testOptions,coverageOptions,null,null);
      let result = await triggerApexTests.exec();

      if (!result.result) {
        throw new Error(`Error: ${result.message}`);
      } else {
        console.log(`\n ${result.message?result.message:""}`);
      }
    } catch (err) {
      console.log("\n");
      console.error(err.message);
      process.exitCode = 1;
    }
  }
}
