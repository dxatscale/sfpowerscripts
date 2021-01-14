import { jest, expect } from "@jest/globals";
import fs = require("fs");
import PackageDiffImpl from "../../src/package/PackageDiffImpl";

let gitTags: string[] = [];
let gitDiff: string[] = [];
let gitShow: string = '';

jest.mock("../../src/utils/Git", () => {
  class Git {
    tag = jest.fn().mockReturnValue(gitTags);
    diff = jest.fn().mockReturnValue(gitDiff);
    show = jest.fn().mockReturnValue(gitShow)
  }

  return Git;
});

let ignoreFilterResult: string[] = [];
jest.mock("../../src/utils/IgnoreFiles", () => {
  class IgnoreFiles {
    filter = jest.fn().mockReturnValue(ignoreFilterResult);
  }

  return IgnoreFiles;
});

describe("Determines whether a given package has changed", () => {

  beforeEach( () => {
    const fsMock = jest.spyOn(fs, "readFileSync");
    fsMock.mockImplementation( () => {
      return packageConfigJson;
    });
  });

  it("should throw error if package does not exist", () => {
    let packageDiffImpl: PackageDiffImpl = new PackageDiffImpl("UNKNOWN-PACKAGE", null, null, null);
    expect(() => packageDiffImpl.exec()).rejects.toThrowError();
  });

  it("should return true if package metadata has changed", async () => {
    gitTags = coreTags;
    gitDiff = [`packages/domains/core/X/Y/Z/A-meta.xml`];

    // Assume passthrough filter for ignore
    ignoreFilterResult = gitDiff;

    let packageDiffImpl: PackageDiffImpl = new PackageDiffImpl("core", null, null, null);
    expect(await packageDiffImpl.exec()).toBe(true);
  });

  it ("should return true if package descriptor has changed", async () => {
    gitTags = coreTags;
    gitDiff = ['sfdx-project.json'];
    gitShow = packageDescriptorChange;

    // Assume passthrough filter for ignore
    ignoreFilterResult = gitDiff;

    let packageDiffImpl: PackageDiffImpl = new PackageDiffImpl("core", null, null, null);
    expect(await packageDiffImpl.exec()).toBe(true);
  });

  it ("should return true if config file has changed", async () => {
    gitTags = coreTags;
    gitDiff = ['config/project-scratch-def.json']

    // Assume passthrough filter for ignore
    ignoreFilterResult = gitDiff;

    let packageDiffImpl: PackageDiffImpl = new PackageDiffImpl("core", null, "config/project-scratch-def.json", null);
    expect(await packageDiffImpl.exec()).toBe(true);
  });
});

const coreTags = [
`core_v1.0.0.2`,
`core_v1.0.0.3`,
`core_v1.0.0.5`,
`core_v1.0.0.6`,
`core_v1.0.0.7`,
`core_v1.0.0.8`,
`core_v1.0.0.9`,
`core_v1.0.0.10`
]

const packageConfigJson: string = `
{
  "packageDirectories": [
    {
      "path": "packages/temp",
      "default": true,
      "package": "temp",
      "versionName": "temp",
      "versionNumber": "1.0.0.0",
      "ignoreOnStage": ["prepare","validate","build"]
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
      "versionNumber": "1.0.0.0"
    },
    {
      "path": "packages/access-mgmt",
      "package": "access-mgmt",
      "default": false,
      "versionName": "access-mgmt",
      "versionNumber": "1.0.0.0",
      "reconcileProfiles": "true"
    },
    {
      "path": "packages/bi",
      "package": "bi",
      "default": false,
      "versionName": "bi",
      "versionNumber": "1.0.0.0",
      "ignoreOnStage":["prepare","validate"]
    }
  ],
  "namespace": "",
  "sfdcLoginUrl": "https://login.salesforce.com",
  "sourceApiVersion": "50.0",
  "packageAliases": {
    "bi":"0x002232323232",
    "core":"0H04X00000000XXXXX"
  }
}
`;

const packageDescriptorChange: string = `
{
  "packageDirectories": [
    {
      "path": "packages/temp",
      "default": true,
      "package": "temp",
      "versionName": "temp",
      "versionNumber": "1.0.0.0",
      "ignoreOnStage": ["prepare","validate","build"]
    },
    {
      "path": "packages/domains/core",
      "package": "core",
      "default": false,
      "versionName": "covax",
      "versionNumber": "1.0.0.0",
      "assignPermSetsPreDeployment": [
        "PermSetA"
      ]
    },
    {
      "path": "packages/frameworks/mass-dataload",
      "package": "mass-dataload",
      "default": false,
      "type":"data",
      "versionName": "mass-dataload",
      "versionNumber": "1.0.0.0"
    },
    {
      "path": "packages/access-mgmt",
      "package": "access-mgmt",
      "default": false,
      "versionName": "access-mgmt",
      "versionNumber": "1.0.0.0",
      "reconcileProfiles": "true"
    },
    {
      "path": "packages/bi",
      "package": "bi",
      "default": false,
      "versionName": "bi",
      "versionNumber": "1.0.0.0",
      "ignoreOnStage":["prepare","validate"]
    }
  ],
  "namespace": "",
  "sfdcLoginUrl": "https://login.salesforce.com",
  "sourceApiVersion": "50.0",
  "packageAliases": {
    "bi":"0x002232323232",
    "core":"0H04X00000000XXXXX"
  }
}
`;
