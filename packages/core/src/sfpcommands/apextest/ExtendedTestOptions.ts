import { ApexClasses } from "../../package/SFPPackage";
import { RunSpecifiedTestsOption } from "../../sfdxwrappers/TestOptions";

export enum ExtendedTestOptions {
  RunAllTestsInPackage = "RunAllTestsInPackage"
}

export class RunAllTestsInPackageOptions extends RunSpecifiedTestsOption {
  public constructor(
    pkg: string,
    wait_time: number,
    outputdir: string,
    specifiedTests: ApexClasses
  ) {
    super(wait_time, outputdir, specifiedTests.toString(), pkg, false);
  }
}
