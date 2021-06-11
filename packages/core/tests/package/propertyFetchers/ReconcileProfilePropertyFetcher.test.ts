import { jest, expect } from "@jest/globals";
import ReconcileProfilePropertyFetcher from "../../../src/package/propertyFetchers/ReconcileProfilePropertyFetcher";
import SFPPackage from "../../../src/package/SFPPackage";

jest.mock("../../../src/package/SFPPackage", () => {
  class SFPPackage {
    private _packageDescriptor: any;

    public reconcileProfiles: boolean;


    get packageDescriptor(): any {
      return this._packageDescriptor;
    }

    public static async buildPackageFromProjectConfig(
      projectDirectory: string,
      sfdx_package: string,
      configFilePath?: string,
      packageLogger?: any
    ) {
      let sfpPackage: SFPPackage = new SFPPackage();
      sfpPackage._packageDescriptor = packageDescriptor;
      return sfpPackage;
    }
  }

  return SFPPackage;
})

describe(
  "Given a package descriptor with reconcileProfiles",
  () => {
  it("Should set reconcileProfiles property in SFPPackage", async () => {
    let reconcileProfilePropertyFetcher: ReconcileProfilePropertyFetcher = new ReconcileProfilePropertyFetcher();
    let sfpPackage: SFPPackage = await SFPPackage.buildPackageFromProjectConfig(null, null, null);
    reconcileProfilePropertyFetcher.getSfpowerscriptsProperties(sfpPackage);
    expect(sfpPackage.reconcileProfiles).toBe(false);
  });
});


const packageDescriptor: any = {
  "path": "force-app",
  "package": "force-app",
  "versionNumber": "1.0.0.NEXT",
  "reconcileProfiles": false
}
