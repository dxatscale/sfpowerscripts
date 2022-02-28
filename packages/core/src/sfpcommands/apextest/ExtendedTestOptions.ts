import SFPPackage from "../../package/SFPPackage";
import { RunSpecifiedTestsOption } from "../../sfdxwrappers/TestOptions";

export enum ExtendedTestOptions {
  RunAllTestsInPackage = "RunAllTestsInPackage"
}

export class RunAllTestsInPackageOptions extends RunSpecifiedTestsOption {
  public constructor(
    private _sfppackage:SFPPackage,
    wait_time: number,
    outputdir: string
  ) {
    //Set to synchronous execution mode, to check whether #836 will be fixed
    super(wait_time, outputdir, _sfppackage.apexTestClassses.toString(), true);
  }

  public get sfppackage()
  {
    return this._sfppackage;
  }
}
