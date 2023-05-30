import SFPLogger, { COLOR_HEADER, Logger } from "@dxatscale/sfp-logger";
import { CoverageOptions } from "@dxatscale/sfpowerscripts.core/lib/apex/coverage/IndividualClassCoverage";
import { TestOptions, RunAllTestsInPackageOptions, RunSpecifiedTestsOption } from "@dxatscale/sfpowerscripts.core/lib/apextest/TestOptions";
import TriggerApexTests from "@dxatscale/sfpowerscripts.core/lib/apextest/TriggerApexTests";
import SfpPackage, { PackageType } from "@dxatscale/sfpowerscripts.core/lib/package/SfpPackage";
import { LoggerLevel } from "@salesforce/core";
import { ValidationMode } from "./ValidateImpl";

export interface ApexTestValidatorOptions
{
  coverageThreshold?:number;
  validationMode:ValidationMode;
  disableParallelTestExecution?:boolean
}

export class ApexTestValidator {

  constructor(
    private targetUsername: string,
    private sfpPackage: SfpPackage,
    private props:ApexTestValidatorOptions,
    private logger: Logger
  ) { }


  public async validateApexTests(
  ): Promise<{
    id: string;
    result: boolean;
    message: string;
  }> {
    if (this.sfpPackage.packageDescriptor.skipTesting)
      return { id: null, result: true, message: "No Tests To Run" };

    if (!this.sfpPackage.isApexFound)
      return { id: null, result: true, message: "No Tests To Run" };

    if (this.sfpPackage.packageDescriptor.isOptimizedDeployment == false)
      return {
        id: null,
        result: true,
        message: "Tests would have already run",
      };

    let testProps;

    if (this.sfpPackage.packageType == PackageType.Diff) {
      testProps = this.getTestOptionsForDiffPackage(this.sfpPackage, this.props);
    } else if (this.props.validationMode == ValidationMode.FAST_FEEDBACK ||
      this.props.validationMode ==
      ValidationMode.FASTFEEDBACK_LIMITED_BY_RELEASE_CONFIG) {
      testProps = this.getTestOptionsForFastFeedBackPackage(
        this.sfpPackage,
        this.props);

    }
    else
      testProps = this.getTestOptionsForFullPackageTest(
        this.sfpPackage,
        this.props);

    let testOptions: TestOptions = testProps.testOptions;
    let testCoverageOptions: CoverageOptions = testProps.testCoverageOptions;


    if (testProps.testOptions == undefined) {
      return { id: null, result: true, message: "No Tests To Run" };
    }

    if (testOptions == undefined) {
      return { id: null, result: true, message: "No Tests To Run" };
    }

    //override any behaviour if the override is from the deploy this.props
    if (this.props.disableParallelTestExecution) testOptions.synchronous = true;
    if (this.sfpPackage.packageType == PackageType.Diff) testOptions.synchronous = true;
    this.displayTestHeader(this.sfpPackage);

    const triggerApexTests: TriggerApexTests = new TriggerApexTests(
      this.targetUsername,
      testOptions,
      testCoverageOptions,
      null,
      this.logger,
    );

    return triggerApexTests.exec();
  }

  private getTestOptionsForFullPackageTest(
    sfpPackage: SfpPackage,
    props: ApexTestValidatorOptions,
  ): { testOptions: TestOptions; testCoverageOptions: CoverageOptions } {


    const testOptions = new RunAllTestsInPackageOptions(
      this.sfpPackage,
      60,
      ".testresults",
    );
    const testCoverageOptions = {
      isIndividualClassCoverageToBeValidated: false,
      isPackageCoverageToBeValidated:
        !this.sfpPackage.packageDescriptor.skipCoverageValidation,
      coverageThreshold: this.props.coverageThreshold || 75,
    };
    return { testOptions, testCoverageOptions };
  }

  private getTestOptionsForDiffPackage(
    sfpPackage: SfpPackage,
    props: ApexTestValidatorOptions,
  ): { testOptions: TestOptions; testCoverageOptions: CoverageOptions } {
   
    //No impacted test class available
    if (!this.sfpPackage.apexTestClassses || this.sfpPackage.apexTestClassses.length == 0) {
      SFPLogger.log(
        `${COLOR_HEADER(
          "Unable to find any impacted test classses,skipping tests, You might need to use thorough option",
        )}`,
      );
      return { testOptions: undefined, testCoverageOptions: undefined };
    }

    SFPLogger.log(
      `${COLOR_HEADER(
        "Diff package detected: triggering impacted test classes",
      )}`,
    );

    const testOptions = new RunSpecifiedTestsOption(
      60,
      ".testResults",
      this.sfpPackage.apexTestClassses.join(),
      true,
    );
    const testCoverageOptions = {
      isIndividualClassCoverageToBeValidated: true,
      isPackageCoverageToBeValidated: false,
      coverageThreshold: this.props.coverageThreshold || 75,
      classesToBeValidated: this.sfpPackage.apexClassWithOutTestClasses
    };
    return { testOptions, testCoverageOptions };
  }

  //TODO: Need to fix test options for earlier behaviour for fast feedback
  private getTestOptionsForFastFeedBackPackage(
    sfpPackage: SfpPackage,
    props: ApexTestValidatorOptions,
  ): { testOptions: TestOptions; testCoverageOptions: CoverageOptions } {

    //No impacted test class available
    if (!this.sfpPackage.apexTestClassses || this.sfpPackage.apexTestClassses.length == 0) {
      SFPLogger.log(
        `${COLOR_HEADER(
          "Unable to find any impacted test classses,skipping tests, You might need to use thorough option",
        )}`,
      );
      return { testOptions: undefined, testCoverageOptions: undefined };
    }

    SFPLogger.log(
      `${COLOR_HEADER(
        "Diff mode activated, Only impacted test class will be triggered",
      )}`,
    );

    const testOptions = new RunSpecifiedTestsOption(
      60,
      ".testResults",
      this.sfpPackage.apexTestClassses.join(),
      true,
    );
    const testCoverageOptions = {
      isIndividualClassCoverageToBeValidated: false,
      isPackageCoverageToBeValidated: false,
      coverageThreshold: 0
    };
    return { testOptions, testCoverageOptions };
  }


  private displayTestHeader(sfpPackage: SfpPackage) {
    SFPLogger.log(
      COLOR_HEADER(
        `-------------------------------------------------------------------------------------------`,
      ),
    );
    SFPLogger.log(
      `Triggering Apex tests for ${this.sfpPackage.packageName}`,
      LoggerLevel.INFO,
    );
    SFPLogger.log(
      COLOR_HEADER(
        `-------------------------------------------------------------------------------------------`,
      ),
    );
  }

}