import { jest, expect } from "@jest/globals";
import AssignPermissionSetFetcher from "../../../src/package/propertyFetchers/AssignPermissionSetFetcher";
import SFPPackage from "../../../src/package/SFPPackage";

jest.mock("../../../src/package/SFPPackage", () => {
  class SFPPackage {
    private _packageDescriptor: any;

    public assignPermSetsPreDeployment?: string[];
    public assignPermSetsPostDeployment?: string[];

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
  "Given a package descriptor with assignPermSetsPreDeployment or assignPermSetsPostDeployment",
  () => {
  it("Should set assignPermSetsPreDeployment property in SFPPackage", async () => {
    let assignPermissionSetFetcher: AssignPermissionSetFetcher = new AssignPermissionSetFetcher();
    let sfpPackage: SFPPackage = await SFPPackage.buildPackageFromProjectConfig(null,null, null);
    assignPermissionSetFetcher.getSfpowerscriptsProperties(sfpPackage);
    expect(sfpPackage.assignPermSetsPreDeployment).toStrictEqual(["PermSetB"]);
  });

  it("Should set assignPermSetsPostDeployment property in SFPPackage", async () => {
    let assignPermissionSetFetcher: AssignPermissionSetFetcher = new AssignPermissionSetFetcher();
    let sfpPackage: SFPPackage = await SFPPackage.buildPackageFromProjectConfig(null,null, null);
    assignPermissionSetFetcher.getSfpowerscriptsProperties(sfpPackage);
    expect(sfpPackage.assignPermSetsPostDeployment).toStrictEqual(["PermSetA"]);
  });
});


const packageDescriptor: any = {
  "path": "force-app",
  "package": "force-app",
  "versionNumber": "1.0.0.NEXT",
  "assignPermSetsPostDeployment": [
    "PermSetA"
  ],
  "assignPermSetsPreDeployment": [
    "PermSetB"
  ]
}
