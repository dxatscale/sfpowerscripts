import fs from "fs-extra";
import { jest, expect } from "@jest/globals";
import PackageManifest from "../../src/package/PackageManifest";
describe("Given a mdapi directory that contains manifest file", () => {
  beforeEach(() => {
    const fsextraMock = jest.spyOn(fs, "readFileSync");
    fsextraMock.mockImplementation(
      (path: any, options: string | { encoding?: string; flag?: string }) => {
        return packageManifestXML;
      }
    );
  });

  it("should  return the manifest in json format", async () => {
    const packageManifest: PackageManifest = await PackageManifest.create("mdapi");
    expect(packageManifest.manifest).toStrictEqual(packageManifestJSON);
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
