import { jest, expect } from "@jest/globals";
import BuildCollections from "../../../src/impl/parallelBuilder/BuildCollections";

let packageManifest = null;
jest.mock("../../../../core/lib/project/ProjectConfig", () => {
  class ProjectConfig {
    static getSFDXPackageManifest(projectDirectory: string) {
      return packageManifest;
    }
  }

  return ProjectConfig;
});

describe("Given a BuildCollections class", () => {
  it("should be able to create a graph of collections defined in a sfdx-project.json", () => {
    packageManifest = packageManifestWithCollections;
    let buildCollections = new BuildCollections(null);
    expect(buildCollections.graph.adjacencyList).toEqual(adjacencyList);
  });

  it("should create an empty graph when there are no collections defined in sfdx-project.json", () => {
    packageManifest = packageManifestWithNoCollections;
    let buildCollections = new BuildCollections(null);
    expect(buildCollections.graph.adjacencyList).toEqual({});
  });

  it("should throw an error when package in collection does not exist", () => {
    packageManifest = packageManifestWithError1;
    expect(() => {new BuildCollections(null)}).toThrowError(`Package 'UNKNOWN' in collection UNKNOWN,core is not a valid package`);
  });

  it("should throw an error when received 'buildCollection' property is not an array", () => {
    packageManifest = packageManifestWithError2;
    expect(() => {new BuildCollections(null)}).toThrowError(`Property 'buildCollection' must be of type Array. Received core`);
  });
});

let adjacencyList = {
  "temp": ["core"],
  "core": ["temp", "mass-dataload", "sales"],
  "mass-dataload": ["core"],
  "access-mgmt": ["bi"],
  "bi": ["access-mgmt"],
  "sales": ["core", "cases"],
  "cases": ["sales"]
}

const packageManifestWithCollections = {
  "packageDirectories": [
    {
      "path": "packages/temp",
      "default": true,
      "package": "temp",
      "versionName": "temp",
      "versionNumber": "1.0.0.0",
      "ignoreOnStage": ["prepare","validate","build"],
      "buildCollection": ["core"]
    },
    {
      "path": "packages/domains/core",
      "package": "core",
      "default": false,
      "versionName": "covax",
      "versionNumber": "1.0.0.0",
      "assignPermSetsPreDeployment": [
        "PermSetA",
        "PermSetB",
        "PermSetC"
      ]
    },
    {
      "path": "packages/frameworks/mass-dataload",
      "package": "mass-dataload",
      "default": false,
      "type":"data",
      "versionName": "mass-dataload",
      "versionNumber": "1.0.0.0",
      "buildCollection": ["core"]
    },
    {
      "path": "packages/access-mgmt",
      "package": "access-mgmt",
      "default": false,
      "versionName": "access-mgmt",
      "versionNumber": "1.0.0.0",
      "reconcileProfiles": "true",
      "buildCollection": ["bi"]
    },
    {
      "path": "packages/bi",
      "package": "bi",
      "default": false,
      "versionName": "bi",
      "versionNumber": "1.0.0.0",
      "ignoreOnStage":["prepare","validate"]
    },
    {
      "path": "packages/sales",
      "package": "sales",
      "default": false,
      "versionName": "sales",
      "versionNumber": "1.0.0.0",
      "buildCollection": ["core"]
    },
    {
      "path": "packages/cases",
      "package": "cases",
      "default": false,
      "versionName": "cases",
      "versionNumber": "1.0.0.0",
      "buildCollection": ["sales"]
    },
  ],
  "namespace": "",
  "sfdcLoginUrl": "https://login.salesforce.com",
  "sourceApiVersion": "50.0",
  "packageAliases": {
    "bi":"0x002232323232",
    "core":"0H04X00000000XXXXX"
  }
}

const packageManifestWithNoCollections = {
  "packageDirectories": [
    {
      "path": "packages/temp",
      "default": true,
      "package": "temp",
      "versionName": "temp",
      "versionNumber": "1.0.0.0",
    }
  ],
  "namespace": "",
  "sfdcLoginUrl": "https://login.salesforce.com",
  "sourceApiVersion": "50.0"
}

const packageManifestWithError1 =  {
  "packageDirectories": [
    {
      "path": "packages/temp",
      "default": true,
      "package": "temp",
      "versionName": "temp",
      "versionNumber": "1.0.0.0",
      "buildCollection": ["UNKNOWN", "core"]
    },
    {
      "path": "packages/domains/core",
      "package": "core",
      "default": false,
      "versionName": "covax",
      "versionNumber": "1.0.0.0",
    }
  ],
  "namespace": "",
  "sfdcLoginUrl": "https://login.salesforce.com",
  "sourceApiVersion": "50.0"
}

const packageManifestWithError2 =  {
  "packageDirectories": [
    {
      "path": "packages/temp",
      "default": true,
      "package": "temp",
      "versionName": "temp",
      "versionNumber": "1.0.0.0",
      "buildCollection": "core"
    },
    {
      "path": "packages/domains/core",
      "package": "core",
      "default": false,
      "versionName": "covax",
      "versionNumber": "1.0.0.0",
    }
  ],
  "namespace": "",
  "sfdcLoginUrl": "https://login.salesforce.com",
  "sourceApiVersion": "50.0"
}
