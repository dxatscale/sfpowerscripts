import { jest, expect } from "@jest/globals";
import DestructiveManifestPathFetcher from "../../../src/package/propertyFetchers/DestructiveManifestPathFetcher";
import SFPPackage from "../../../src/package/SFPPackage";
import fs from "fs-extra";

jest.mock("../../../src/package/SFPPackage", () => {
  class SFPPackage {
    private _packageDescriptor: any;

    public destructiveChangesPath: string;
    public destructiveChanges?: any;


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
  "Given a package descriptor with a destructiveChangePath",
  () => {

  beforeEach( () => {
    jest.spyOn(fs, "readFileSync").mockImplementation( () => {
      return destructiveChangesXml;
    });
  });

  it("Should set destructiveChangesPath property in SFPPackage", async () => {
    let destructiveManifestPathFetcher: DestructiveManifestPathFetcher = new DestructiveManifestPathFetcher();
    let sfpPackage: SFPPackage = await SFPPackage.buildPackageFromProjectConfig(null,null, null);
    await destructiveManifestPathFetcher.getSfpowerscriptsProperties(sfpPackage);
    expect(sfpPackage.destructiveChangesPath).toBe("destructiveChanges.xml");
  });

  it("Should set destructiveChanges property in SFPPackage", async () => {
    let destructiveManifestPathFetcher: DestructiveManifestPathFetcher = new DestructiveManifestPathFetcher();
    let sfpPackage: SFPPackage = await SFPPackage.buildPackageFromProjectConfig(null,null, null);
    await destructiveManifestPathFetcher.getSfpowerscriptsProperties(sfpPackage);
    expect(sfpPackage.destructiveChanges).toStrictEqual(destructiveChanges);
  });
});


const packageDescriptor: any = {
  "path": "force-app",
  "package": "force-app",
  "versionNumber": "1.0.0.NEXT",
  "destructiveChangePath": "destructiveChanges.xml"
};

const destructiveChangesXml: string = `
<?xml version="1.0" encoding="UTF-8"?>
<Package xmlns="http://soap.sforce.com/2006/04/metadata">
    <types>
        <members>MyCustomObject__c</members>
        <name>CustomObject</name>
    </types>
</Package>
`
const destructiveChanges: any = {
  "Package": {
    "$": {
    "xmlns": "http://soap.sforce.com/2006/04/metadata",
    },
    "types": {
      "members": "MyCustomObject__c",
      "name": "CustomObject",
    }
  }
};
