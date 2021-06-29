import { jest,expect } from "@jest/globals";
import child_process = require("child_process");
import ArtifactInstallationStatusUpdater from "../../src/artifacts/ArtifactInstallationStatusUpdater";
import ArtifactMigrator from "../../src/artifacts/ArtifactMigrator";
import InstalledAritfactsFetcher from "../../src/artifacts/InstalledAritfactsFetcher";
import { VoidLogger } from "../../src/logger/SFPLogger";
import PackageMetadata from "../../src/PackageMetadata";

describe("Fetch a list of sfpowerscripts artifacts from an org", () => {


  beforeEach(() => {
    InstalledAritfactsFetcher.resetFetchedArtifacts();
    jest.spyOn(ArtifactMigrator, "exec").mockResolvedValue();
  });

  it("Return a  blank list of sfpowerscripts artifact, if there are no previously installed artifacts ", async () => {
    const child_processMock = jest.spyOn(child_process, "execSync");
    child_processMock.mockImplementation(() => {
      return Buffer.from(`{
        "status": 0,
        "result": {
          "totalSize": 0,
          "done": true,
          "records": []
        }
      }`);
    });
    let artifacts = await InstalledAritfactsFetcher.getListofArtifacts(
      "testOrg"
    );
    expect(artifacts).toEqual([]);
  });

  it("Return a list of sfpowerscripts artifact, if there are previously installed artifacts ", async () => {
    const child_processMock = jest.spyOn(child_process, "execSync");
    child_processMock.mockImplementation(() => {
      return Buffer.from(`{
        "status": 0,
        "result": {
          "totalSize": 1,
          "done": true,
          "records": [
            {
              "attributes": {
                "type": "SfpowerscriptsArtifact__c",
                "url": "/services/data/v50.0/sobjects/SfpowerscriptsArtifact__c/a0zR0000003F1FuIAK"
              },
              "Id": "a0zR0000003F1FuIAK",
              "Name": "sfpowerscripts-artifact",
              "CommitId__c": "0a516404aa92f02866f9d2725bda5b1b3f23547e",
              "Version__c": "1.0.0.NEXT",
              "Tag__c": "undefined"
            }
          ]
        }
      }`);
    });
    let artifacts = await InstalledAritfactsFetcher.getListofArtifacts(
      "testOrg2"
    );
    let expectedArtifact = {
      attributes: {
        type: "SfpowerscriptsArtifact__c",
        url:
          "/services/data/v50.0/sobjects/SfpowerscriptsArtifact__c/a0zR0000003F1FuIAK",
      },
      Id: "a0zR0000003F1FuIAK",
      Name: "sfpowerscripts-artifact",
      CommitId__c: "0a516404aa92f02866f9d2725bda5b1b3f23547e",
      Version__c: "1.0.0.NEXT",
      Tag__c: "undefined",
    };
    expect(artifacts).toEqual([expectedArtifact]);
  });

  it("When unable to fetch, it should throw an error", () => {

  expect(InstalledAritfactsFetcher.getListofArtifacts("testOrg2")).rejects.toThrow();
  });

  it("Should return artifacts from stored query result for repeated calls", async () => {
    const child_processMock = jest.spyOn(child_process, "execSync");
    child_processMock.mockImplementationOnce(() => {
      return Buffer.from(`{
        "status": 0,
        "result": {
          "totalSize": 1,
          "done": true,
          "records": [
            {
              "attributes": {
                "type": "SfpowerscriptsArtifact__c",
                "url": "/services/data/v50.0/sobjects/SfpowerscriptsArtifact__c/a0zR0000003F1FuIAK"
              },
              "Id": "a0zR0000003F1FuIAK",
              "Name": "sfpowerscripts-artifact",
              "CommitId__c": "0a516404aa92f02866f9d2725bda5b1b3f23547e",
              "Version__c": "1.0.0.NEXT",
              "Tag__c": "undefined"
            }
          ]
        }
      }`);
    });
    let artifacts = await InstalledAritfactsFetcher.getListofArtifacts(
      "testOrg2"
    );

    // Repeat call
    artifacts = await InstalledAritfactsFetcher.getListofArtifacts(
      "testOrg2"
    );

    let expectedArtifact = {
      attributes: {
        type: "SfpowerscriptsArtifact__c",
        url:
          "/services/data/v50.0/sobjects/SfpowerscriptsArtifact__c/a0zR0000003F1FuIAK",
      },
      Id: "a0zR0000003F1FuIAK",
      Name: "sfpowerscripts-artifact",
      CommitId__c: "0a516404aa92f02866f9d2725bda5b1b3f23547e",
      Version__c: "1.0.0.NEXT",
      Tag__c: "undefined",
    };
    expect(artifacts).toEqual([expectedArtifact]);
  });

  it("Should get artifacts from the correct org", async () => {
    const child_processMock = jest.spyOn(child_process, "execSync");
    child_processMock.mockImplementationOnce(() => {
      return Buffer.from(`{
        "status": 0,
        "result": {
          "totalSize": 1,
          "done": true,
          "records": [
            {
              "attributes": {
                "type": "SfpowerscriptsArtifact__c",
                "url": "/services/data/v50.0/sobjects/SfpowerscriptsArtifact__c/a0zR0000003F1FuIAK"
              },
              "Id": "a0zR0000003F1FuIAK",
              "Name": "sfpowerscripts-artifact",
              "CommitId__c": "0a516404aa92f02866f9d2725bda5b1b3f23547e",
              "Version__c": "1.0.0.NEXT",
              "Tag__c": "undefined"
            }
          ]
        }
      }`);
    }).mockImplementationOnce(() => {
      return Buffer.from(`{
        "status": 0,
        "result": {
          "totalSize": 1,
          "done": true,
          "records": [
            {
              "attributes": {
                "type": "SfpowerscriptsArtifact__c",
                "url": "/services/data/v50.0/sobjects/SfpowerscriptsArtifact__c/a4r4Y00000002VQQAY"
              },
              "Id": "a4r4Y00000002VQQAY",
              "Name": "sfpowerscripts-artifact",
              "CommitId__c": "0a516404aa92f02866f9d2725bda5b1b3f23547e",
              "Version__c": "1.0.0.NEXT",
              "Tag__c": "undefined"
            }
          ]
        }
      }`);
    });

    let artifactsTestOrg1 = await InstalledAritfactsFetcher.getListofArtifacts(
      "testOrg1"
    );

    let expectedArtifactTestOrg1 = {
      attributes: {
        type: "SfpowerscriptsArtifact__c",
        url:
          "/services/data/v50.0/sobjects/SfpowerscriptsArtifact__c/a0zR0000003F1FuIAK",
      },
      Id: "a0zR0000003F1FuIAK",
      Name: "sfpowerscripts-artifact",
      CommitId__c: "0a516404aa92f02866f9d2725bda5b1b3f23547e",
      Version__c: "1.0.0.NEXT",
      Tag__c: "undefined",
    };
    expect(artifactsTestOrg1).toEqual([expectedArtifactTestOrg1]);

    let artifactsTestOrg2 = await InstalledAritfactsFetcher.getListofArtifacts(
      "testOrg2"
    );
    let expectedArtifactTestOrg2 = {
      attributes: {
        type: "SfpowerscriptsArtifact__c",
        url:
          "/services/data/v50.0/sobjects/SfpowerscriptsArtifact__c/a4r4Y00000002VQQAY",
      },
      Id: "a4r4Y00000002VQQAY",
      Name: "sfpowerscripts-artifact",
      CommitId__c: "0a516404aa92f02866f9d2725bda5b1b3f23547e",
      Version__c: "1.0.0.NEXT",
      Tag__c: "undefined",
    };
    expect(artifactsTestOrg2).toEqual([expectedArtifactTestOrg2]);
  });
});


describe("Update a sfpowerscripts artifact to an org",()=>{

  beforeEach(() => {
    jest.restoreAllMocks();
    InstalledAritfactsFetcher.resetFetchedArtifacts();
    jest.spyOn(ArtifactMigrator, "exec").mockResolvedValue();
  });

  it("Update a sfpowerscripts artifact, installing it the first time",async ()=>{
    const child_processMock = jest.spyOn(child_process, "execSync");
    child_processMock.mockImplementationOnce(() => {
      return Buffer.from(`{
        "status": 0,
        "result": {
          "totalSize": 0,
          "done": true,
          "records": []
        }
      }`);
    }).mockImplementationOnce(()=>{
      return Buffer.from(`{
        "status": 0,
        "result": {
          "id": "a0zR0000003F1IKIA0",
          "success": true,
          "errors": []
        }
      }`)
    });

   let packageMetadata:PackageMetadata = {
     package_name:"core",
     repository_url:"https://example.com",
     package_version_number:"1.0.0.NEXT",
     sourceVersion:"3232x232xc3e"
   }

   let result = await ArtifactInstallationStatusUpdater.updatePackageInstalledInOrg(new VoidLogger(),"testorg",packageMetadata);
   expect(result).toEqual(true);

  });

  it("Update a sfpowerscripts artifact, installing a newer version of it",async ()=>{

    const child_processMock = jest.spyOn(child_process, "execSync");
    child_processMock.mockImplementationOnce(() => {
      return Buffer.from(`{
        "status": 0,
        "result": {
          "totalSize": 1,
          "done": true,
          "records": [
            {
              "attributes": {
                "type": "SfpowerscriptsArtifact__c",
                "url": "/services/data/v50.0/sobjects/SfpowerscriptsArtifact__c/a0zR0000003F1FuIAK"
              },
              "Id": "a0zR0000003F1FuIAK",
              "Name": "core",
              "CommitId__c": "0a516404aa92f02866f9d2725bda5b1b3f23547e",
              "Version__c": "1.0.0.NEXT",
              "Tag__c": "undefined"
            }
          ]
        }
      }`);
    }).mockImplementationOnce(()=>{
      return Buffer.from(`{
        "status": 0,
        "result": {
          "id": "a0zR0000003F1FuIAK",
          "success": true,
          "errors": []
        }
      }`)
    });

   let packageMetadata:PackageMetadata = {
     package_name:"core",
     repository_url:"https://example.com",
     package_version_number:"1.0.0.NEXT",
     sourceVersion:"3232x232xc3e"
   }

   let result = await ArtifactInstallationStatusUpdater.updatePackageInstalledInOrg(new VoidLogger(),"testorg",packageMetadata);
   expect(result).toEqual(true);

  });


  it("Update a sfpowerscripts artifact and resulting an error,should return falsy",()=>{

    const child_processMock = jest.spyOn(child_process, "execSync");
    child_processMock.mockImplementationOnce(() => {
      return Buffer.from(`{
        "status": 0,
        "result": {
          "totalSize": 1,
          "done": true,
          "records": [
            {
              "attributes": {
                "type": "SfpowerscriptsArtifact__c",
                "url": "/services/data/v50.0/sobjects/SfpowerscriptsArtifact__c/a0zR0000003F1FuIAK"
              },
              "Id": "a0zR0000003F1FuIAK",
              "Name": "core",
              "CommitId__c": "0a516404aa92f02866f9d2725bda5b1b3f23547e",
              "Version__c": "1.0.0.NEXT",
              "Tag__c": "undefined"
            }
          ]
        }
      }`);
    }).mockImplementationOnce(()=>{
      return Buffer.from(`{
      }`)
    });

   let packageMetadata:PackageMetadata = {
     package_name:"core",
     repository_url:"https://example.com",
     package_version_number:"1.0.0.NEXT",
     sourceVersion:"3232x232xc3e"
   }


   expect(ArtifactInstallationStatusUpdater.updatePackageInstalledInOrg(new VoidLogger(),"testorg",packageMetadata)).resolves.toBeFalsy;

  });

});
