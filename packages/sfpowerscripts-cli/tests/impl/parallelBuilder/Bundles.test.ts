import { jest, expect } from "@jest/globals";
import Bundles from "../../../src/impl/parallelBuilder/Bundles";

let packageManifest = null;
jest.mock("../../../../core/lib/project/ProjectConfig", () => {
  class ProjectConfig {
    static getSFDXPackageManifest(projectDirectory: string) {
      return packageManifest;
    }
  }

  return ProjectConfig;
});

describe("Given a Bundles class", () => {
  it("should be able to create a graph of bundles defined in a sfdx-project.json", () => {
    packageManifest = packageManifestWithBundles;
    let bundles = new Bundles(null);
    expect(bundles.graph.adjacencyList).toEqual(adjacencyList);
  });

  it("should create an empty graph when there are no bundles defined in sfdx-project.json", () => {
    packageManifest = packageManifestWithNoBundles;
    let bundles = new Bundles(null);
    expect(bundles.graph.adjacencyList).toEqual({});
  });

  it("should throw an error when bundled package does not exist", () => {
    packageManifest = packageManifestWithError1;
    expect(() => {new Bundles(null)}).toThrowError(`Package 'UNKNOWN' in bundle UNKNOWN,core is not a valid package`);
  });

  it("should throw an error when received 'bundle' property is not an array", () => {
    packageManifest = packageManifestWithError2;
    expect(() => {new Bundles(null)}).toThrowError(`Property 'bundle' must be of type Array. Received core`);
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

const packageManifestWithBundles = {
  "packageDirectories": [
    {
      "path": "packages/temp",
      "default": true,
      "package": "temp",
      "versionName": "temp",
      "versionNumber": "1.0.0.0",
      "ignoreOnStage": ["prepare","validate","build"],
      "bundle": ["core"]
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
      "bundle": ["core"]
    },
    {
      "path": "packages/access-mgmt",
      "package": "access-mgmt",
      "default": false,
      "versionName": "access-mgmt",
      "versionNumber": "1.0.0.0",
      "reconcileProfiles": "true",
      "bundle": ["bi"]
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
      "bundle": ["core"]
    },
    {
      "path": "packages/cases",
      "package": "cases",
      "default": false,
      "versionName": "cases",
      "versionNumber": "1.0.0.0",
      "bundle": ["sales"]
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

const packageManifestWithNoBundles = {
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
      "bundle": ["UNKNOWN", "core"]
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
      "bundle": "core"
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
