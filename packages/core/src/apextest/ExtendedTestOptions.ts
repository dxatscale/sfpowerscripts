import SFPPackage from "../package/SFPPackage";
import { RunSpecifiedTestsOption } from "./TestOptions";

export enum ExtendedTestOptions {
  RunAllTestsInPackage = "RunAllTestsInPackage"
}

export class RunAllTestsInPackageOptions extends RunSpecifiedTestsOption {
  public constructor(
    private _sfppackage:SFPPackage,
    wait_time: number,
    outputdir: string
  ) {
    super(wait_time, outputdir, _sfppackage.apexTestClassses.toString(), false);
  }

  public get sfppackage()
  {
    return this._sfppackage;
  }
}
