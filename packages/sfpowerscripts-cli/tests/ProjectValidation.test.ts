
import ProjectConfig from "@dxatscale/sfpowerscripts.core/lib/project/ProjectConfig";
import { jest, expect } from "@jest/globals";
import ProjectValidation from "../src/ProjectValidation"

describe("Given a sfdx-project.json, it should be validated against the scehma", () => {

  it("should not throw an error for a valid sfdx-project.json without any sfpowerscripts decorators", () => {

    let sfdx_project={
      "packageDirectories": [
        {
          "path": "packages/temp",
          "default": true,
          "package": "temp",
          "versionName": "temp",
          "versionNumber": "1.0.0.0"
        },
        {
          "path": "packages/domains/core",
          "package": "core",
          "default": false,
          "versionName": "core",
          "versionNumber": "1.0.0.0"
        },
        {
          "path": "packages/frameworks/mass-dataload",
          "package": "mass-dataload",
          "default": false,
          "versionName": "mass-dataload",
          "versionNumber": "1.0.0.0"
        },
        {
          "path": "packages/access-mgmt",
          "package": "access-mgmt",
          "default": false,
          "versionName": "access-mgmt",
          "versionNumber": "1.0.0.0"
        },
        {
          "path": "packages/bi",
          "package": "bi",
          "default": false,
          "versionName": "bi",
          "versionNumber": "1.0.0.0"
        }
      ],
      "namespace": "",
      "sfdcLoginUrl": "https://login.salesforce.com",
      "sourceApiVersion": "50.0",
       "packageAliases":
         { "bi":"04t000000000000" }

    };

    const projectConfigMock = jest.spyOn(ProjectConfig, "getSFDXPackageManifest");
    projectConfigMock.mockImplementation(()=>{return sfdx_project})
    expect(() => { new ProjectValidation().validateSFDXProjectJSON(); }).not.toThrow();
  });


  it("should throw an error for a sfdx-project.json where a package directory is missing package name", () => {

    let sfdx_project={
      "packageDirectories": [
        {
          "path": "packages/temp",
          "default": true,
          "package": "temp",
          "versionName": "temp",
          "versionNumber": "1.0.0.0",
        },
        {
          "path": "packages/domains/core",
          "package": "core",
          "default": false,
          "versionName": "core",
          "versionNumber": "1.0.0.0"
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
          "versionNumber": "1.0.0.0"
        },
        {
          "path": "packages/bi",
        }
      ],
      "namespace": "",
      "sfdcLoginUrl": "https://login.salesforce.com",
      "sourceApiVersion": "50.0",
       "packageAliases":
       { "bi":"04t000000000000" }

    };

    const projectConfigMock = jest.spyOn(ProjectConfig, "getSFDXPackageManifest");
    projectConfigMock.mockImplementation(()=>{return sfdx_project})
    expect(() => { new ProjectValidation().validateSFDXProjectJSON(); }).toThrow();
  });



  it("should not throw an error for a sfdx-project.json where various sfpowerscripts orchestrator properties are used", () => {

    let sfdx_project={
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
          "versionName": "core",
          "versionNumber": "1.0.0.0",
          "skipCoverageValidation":true,
          "skipTesting": true,
          "isOptimizedDeployment":false,
          "destructiveChangePath":"test/1.xml"
        },
        {
          "path": "packages/frameworks/mass-dataload",
          "package": "mass-dataload",
          "default": false,
          "type":"data",
          "versionName": "mass-dataload",
          "versionNumber": "1.0.0.0" ,
          "postDeploymentScript":"test/1.bat",
          "preDeploymentScript":"test/2.bat",
          "assignPermSetsPreDeployment":["PS1","PS2"],
          "assignPermSetsPostDeployment":["PS3","PS4"]
        },
        {
          "path": "packages/access-mgmt",
          "package": "access-mgmt",
          "default": false,
          "versionName": "access-mgmt",
          "versionNumber": "1.0.0.0",
          "reconcileProfiles": true,
          "alwaysDeploy":true
        },
        {
          "path": "packages/bi",
          "package": "bi",
          "default": false,
          "versionName": "bi",
          "versionNumber": "1.0.0.0",
          "aliasfy":true,
          "skipDeployOnOrgs":["uat"]
        }
      ],
      "namespace": "",
      "sfdcLoginUrl": "https://login.salesforce.com",
      "sourceApiVersion": "50.0",
       "packageAliases":
       { "bi":"04t000000000000" },
       "plugins": {
         "ignoreFiles": {
           "prepare": "path/to/.forceignore",
           "validate": "path/to/.forceignore",
           "quickbuild": "path/to/.forceignore",
           "build": "path/to/.forceignore"
         }
       }
    };

    const projectConfigMock = jest.spyOn(ProjectConfig, "getSFDXPackageManifest");
    projectConfigMock.mockImplementation(()=>{return sfdx_project})
    expect(() => { new ProjectValidation().validateSFDXProjectJSON(); }).not.toThrow();
  });

  it("should throw an error for a sfdx-project.json where various sfpowerscripts orchestrator properties are incorrectly used", () => {

    let sfdx_project={
      "packageDirectories": [
        {
          "path": "packages/temp",
          "default": true,
          "package": "temp",
          "versionName": "temp",
          "versionNumber": "1.0.0.0",
          "ignoreOnStage": ["prepare","validate","build","test"]
        },
        {
          "path": "packages/domains/core",
          "package": "core",
          "default": false,
          "versionName": "core",
          "versionNumber": "1.0.0.0",
          "skipCoverageValidation":true,
          "skipTesting": "true",
          "isOptimizedDeployment":false,
          "destructiveChangePath":true
        },
        {
          "path": "packages/frameworks/mass-dataload",
          "package": "mass-dataload",
          "default": false,
          "type":"data",
          "versionName": "mass-dataload",
          "versionNumber": "1.0.0.0" ,
          "postDeploymentScript":"test/1.bat",
          "preDeploymentScript":"test/2.bat",
          "assignPermsetsPreDeployment":["PS1","PS2"],
          "assignPermsetsPostDeployment":["PS3","PS4"]
        },
        {
          "path": "packages/access-mgmt",
          "package": "access-mgmt",
          "default": false,
          "versionName": "access-mgmt",
          "versionNumber": "1.0.0.0",
          "reconcileProfiles": "true",
          "alwaysDeploy":true
        },
        {
          "path": "packages/bi",
          "package": "bi",
          "default": false,
          "versionName": "bi",
          "versionNumber": "1.0.0.0",
          "aliasfy":"false",
          "skipDeployOnOrgs":["uat"]
        }
      ],
      "namespace": "",
      "sfdcLoginUrl": "https://login.salesforce.com",
      "sourceApiVersion": "50.0",
       "packageAliases":
       { "bi":"04t000000000000" }
    };

    const projectConfigMock = jest.spyOn(ProjectConfig, "getSFDXPackageManifest");
    projectConfigMock.mockImplementation(()=>{return sfdx_project})
    expect(() => { new ProjectValidation().validateSFDXProjectJSON(); }).toThrow();
  });


  it("should not throw an package-specific error for sfdx-project.json when version number is used correctly", () => {

    // sfdx-project.json includes one source package with specific build number (valid) and one unlocked package using NEXT keyword (also valid)
    let sfdx_project={
      "packageDirectories": [
        {
          "path": "packages/temp",
          "default": true,
          "package": "temp",
          "type": "source",
          "versionName": "temp",
          "versionNumber": "1.0.0.0"
        },
        {
          "path": "packages/domains/core",
          "package": "core",
          "default": false,
          "versionName": "core",
          "versionNumber": "1.0.0.NEXT"
        }
      ],
      "namespace": "",
      "sfdcLoginUrl": "https://login.salesforce.com",
      "sourceApiVersion": "50.0",
       "packageAliases":
        { "core":"04t000000000000" }
    };

    const projectConfigMock = jest.spyOn(ProjectConfig, "getSFDXPackageManifest");
    projectConfigMock.mockImplementation(()=>{return sfdx_project})
    expect(() => { new ProjectValidation().validatePackageBuildNumbers(); }).not.toThrow();
  });


  it("should throw a package-specific error for sfdx-project.json when version number is used incorrectly", () => {

    // sfdx-project.json includes two source packages. One with specific build number (valid), one using NEXT keyword (invalid)
    let sfdx_project={
      "packageDirectories": [
        {
          "path": "packages/temp",
          "default": true,
          "package": "temp",
          "type": "source",
          "versionName": "temp",
          "versionNumber": "1.0.0.0"
        },
        {
          "path": "packages/domains/core",
          "package": "invalid_core_pkg",
          "default": false,
          "type": "source",
          "versionName": "core",
          "versionNumber": "1.0.0.NEXT"
        }
      ],
      "namespace": "",
      "sfdcLoginUrl": "https://login.salesforce.com",
      "sourceApiVersion": "50.0"
    };

    const projectConfigMock = jest.spyOn(ProjectConfig, "getSFDXPackageManifest");
    projectConfigMock.mockImplementation(()=>{return sfdx_project});

    let excep;
    try {
      new ProjectValidation().validatePackageBuildNumbers();
    }
    catch(error) {
      excep = error;
    }

    expect(excep);
    expect(excep.message).toContain('invalid_core_pkg');
  });
  
});
