import { jest, expect } from "@jest/globals";
import SFPPackage from "../../src/package/SFPPackage";
import fs from "fs-extra";

let packageType = "Source";
jest.mock("../../src/project/ProjectConfig", () => {
  class ProjectConfig {
    static getSFDXPackageDescriptor(projectDirectory, sfdx_package) {
      return {
        path: "packages/domains/core",
        package: "core",
        default: false,
        versionName: "core",
        versionNumber: "1.0.0.0",
      };
    }

    static getSFDXPackageManifest = jest.fn();
    static getPackageType(projectConfig: any, sfdxPackage: string) {
      return packageType;
    }
  }
  return ProjectConfig;
});

jest.mock("../../src/generators/SourcePackageGenerator", () => {
  class SourcePackageGenerator {
    static generateSourcePackageArtifact(
      projectDirectory: string,
      sfdx_package: string,
      packageDirectory: string,
      destructiveManifestFilePath?: string,
      configFilePath?: string,
      pathToReplacementForceIgnore?: string
    ): string {
      return ".sfpowerscripts/3sIRD_source";
    }
  }

  return SourcePackageGenerator;
});

jest.mock("../../src/sfdxwrappers/ConvertSourceToMDAPIImpl", () => {
  class ConvertSourceToMDAPIImpl {
    exec = jest.fn().mockReturnValueOnce(Promise.resolve("mdapidir"));
  }
  return ConvertSourceToMDAPIImpl;
});

jest.mock("../../src/package/MetadataCount", () => {
  class MetadataCount {
    static getMetadataCount = jest.fn().mockReturnValue(20);
  }
  return MetadataCount;
});

jest.mock("../../src/apex/parser/ApexTypeFetcher", () => {
  class ApexTypeFetcher {
    getClassesClassifiedByType = jest.fn();
    getTestClasses = jest
      .fn()
      .mockReturnValue(
        new Array<string>(
          "AccountTriggerHandlerTest",
          "Generate_Dose_Admin_PdfTest",
          "RecordHunterController_Test",
          "SObjectController2Test",
          "Send_Receipt_Test",
          "TestDataFactory",
          "TestFileRestriction",
          "appoinmentSchedulerControllerTest"
        )
      );

    getClassesOnlyExcludingTestsAndInterfaces = jest
      .fn()
      .mockReturnValue(
        new Array<string>(
          "AccountTriggerHandler",
          "Data_TableV2_Controller",
          "Generate_Dose_Admin_Pdf",
          "Generate_QR_Code",
          "RecordHunterController",
          "RecordHunterField",
          "RecordHunterLexer",
          "SObjectController2",
          "Send_Receipt"
        )
      );
  }

  return ApexTypeFetcher;
});

describe("Given a sfdx package, build a sfpowerscripts package", () => {
  it("should build a sfpowerscripts package", async () => {
    const fsextraMock = jest.spyOn(fs, "readFileSync");
    fsextraMock.mockImplementation(
      (path: any, options: string | { encoding?: string; flag?: string }) => {
        return packageManifestXML;
      }
    );

    let sfpPackage: SFPPackage = await SFPPackage.buildPackageFromProjectConfig(
      null,
      null,
      "ESBaseCodeLWC"
    );
    expect(sfpPackage.isProfilesInPackage).toStrictEqual(false);
    expect(sfpPackage.isApexInPackage).toStrictEqual(true);
    expect(sfpPackage.isPermissionSetGroupInPackage).toStrictEqual(true);
    expect(sfpPackage.triggers).toBeUndefined();
    expect(sfpPackage.packageType).toStrictEqual("Source");
    expect(sfpPackage.payload).toStrictEqual(packageManifestJSON);
    expect(sfpPackage.mdapiDir).toStrictEqual("mdapidir");
    expect(sfpPackage.packageDescriptor).toStrictEqual({
      path: "packages/domains/core",
      package: "core",
      default: false,
      versionName: "core",
      versionNumber: "1.0.0.0",
    });
    expect(sfpPackage.apexTestClassses).toStrictEqual(
      new Array<string>(
        "AccountTriggerHandlerTest",
        "Generate_Dose_Admin_PdfTest",
        "RecordHunterController_Test",
        "SObjectController2Test",
        "Send_Receipt_Test",
        "TestDataFactory",
        "TestFileRestriction",
        "appoinmentSchedulerControllerTest"
      )
    );
    expect(sfpPackage.apexClassWithOutTestClasses).toStrictEqual(
      new Array<string>(
        "AccountTriggerHandler",
        "Data_TableV2_Controller",
        "Generate_Dose_Admin_Pdf",
        "Generate_QR_Code",
        "RecordHunterController",
        "RecordHunterField",
        "RecordHunterLexer",
        "SObjectController2",
        "Send_Receipt"
      )
    );
  });

  it("should build a sfpowerscripts package when there is only one type", async () => {


    const fsextraMock = jest.spyOn(fs, "readFileSync");
    fsextraMock.mockImplementation(
      (path: any, options: string | { encoding?: string; flag?: string }) => {
        return packageManifestXML2;
      }
    );



     let sfpPackage:SFPPackage = await SFPPackage.buildPackageFromProjectConfig(null,null,"ESBaseCodeLWC");
     expect(sfpPackage.isProfilesInPackage).toStrictEqual(true);
     expect(sfpPackage.isApexInPackage).toStrictEqual(false);
     expect(sfpPackage.triggers).toBeUndefined();
     expect(sfpPackage.packageType).toStrictEqual("Source");
     expect(sfpPackage.mdapiDir).toStrictEqual("mdapidir");
     expect(sfpPackage.packageDescriptor).toStrictEqual({
      path: "packages/domains/core",
      package: "core",
      default: false,
      versionName: "core",
      versionNumber: "1.0.0.0",
    });
     expect(sfpPackage.isProfileSupportedMetadataInPackage).toStrictEqual(false);


  });


});

let packageManifestJSON = {
  Package: {
    $: { xmlns: "http://soap.sforce.com/2006/04/metadata" },
    types: [
      {
        name: "AuraDefinitionBundle",
        members: ["openRecordAction", "selectObject"],
      },
      {
        name: "ApexClass",
        members: [
          "CustomerServices",
          "CustomerServicesTest",
          "MarketServices",
          "MarketServicesTest",
          "TestDataFactory",
        ],
      },
      {
        name: "CustomMetadata",
        members: [
          "Customer_Fields.Contact_Customer_Fields",
          "Customer_Fields.Lead_Customer_Fields",
        ],
      },
      {
        name: "Layout",
        members: "Customer_Fields__mdt-Customer Fields Layout",
      },
      { name: "LightningComponentBundle", members: ["errorPanel", "ldsUtils"] },
      {
        name: "LightningMessageChannel",
        members: ["Flow_Status_Change", "Tile_Selection"],
      },
      { name: "CustomObject", members: "Customer_Fields__mdt" },
      { name: "PermissionSetGroup", members: "TestPermissionSetGroup" },
      {
        name: "CustomField",
        members: [
          "Customer_Fields__mdt.Customer_City__c",
          "Customer_Fields__mdt.Customer_Draft_Status_Values__c",
          "Customer_Fields__mdt.Customer_Email__c",
          "Customer_Fields__mdt.Customer_Name__c",
          "Customer_Fields__mdt.Customer_Reservation_Status_Value__c",
          "Customer_Fields__mdt.Customer_State__c",
          "Customer_Fields__mdt.Customer_Status__c",
          "Customer_Fields__mdt.Sobject_Type__c",
        ],
      },
    ],
    version: "50.0",
  },
};

let packageManifestXML: string = `
<?xml version="1.0" encoding="UTF-8"?>
<Package xmlns="http://soap.sforce.com/2006/04/metadata">
  <types>
    <name>AuraDefinitionBundle</name>
    <members>openRecordAction</members>
    <members>selectObject</members>
  </types>
  <types>
    <name>ApexClass</name>
    <members>CustomerServices</members>
    <members>CustomerServicesTest</members>
    <members>MarketServices</members>
    <members>MarketServicesTest</members>
    <members>TestDataFactory</members>
  </types>
  <types>
    <name>CustomMetadata</name>
    <members>Customer_Fields.Contact_Customer_Fields</members>
    <members>Customer_Fields.Lead_Customer_Fields</members>
  </types>
  <types>
    <name>Layout</name>
    <members>Customer_Fields__mdt-Customer Fields Layout</members>
  </types>
  <types>
    <name>LightningComponentBundle</name>
    <members>errorPanel</members>
    <members>ldsUtils</members>
  </types>
  <types>
    <name>LightningMessageChannel</name>
    <members>Flow_Status_Change</members>
    <members>Tile_Selection</members>
  </types>
  <types>
    <name>CustomObject</name>
    <members>Customer_Fields__mdt</members>
  </types>
  <types>
  <name>PermissionSetGroup</name>
  <members>TestPermissionSetGroup</members>
</types>
  <types>
    <name>CustomField</name>
    <members>Customer_Fields__mdt.Customer_City__c</members>
    <members>Customer_Fields__mdt.Customer_Draft_Status_Values__c</members>
    <members>Customer_Fields__mdt.Customer_Email__c</members>
    <members>Customer_Fields__mdt.Customer_Name__c</members>
    <members>Customer_Fields__mdt.Customer_Reservation_Status_Value__c</members>
    <members>Customer_Fields__mdt.Customer_State__c</members>
    <members>Customer_Fields__mdt.Customer_Status__c</members>
    <members>Customer_Fields__mdt.Sobject_Type__c</members>
  </types>
  <version>50.0</version>
</Package>
`;

let packageManifestXML2: string = `
<?xml version="1.0" encoding="UTF-8"?>
<Package xmlns="http://soap.sforce.com/2006/04/metadata">
  <types>
    <name>Profile</name>
    <members>CustomerServices</members>
    <members>CustomerServicesTest</members>
    <members>MarketServices</members>
    <members>MarketServicesTest</members>
    <members>TestDataFactory</members>
  </types>
  <version>50.0</version>
</Package>
`;
