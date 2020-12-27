import ManifestHelpers from "../../src/manifest/ManifestHelpers";
import fs from 'fs-extra';



describe("Given a project directory or sfdx-project.json with multiple packages",()=>{


  //given the below sfdx-project.json
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
        "versionName": "covax",
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
     "packageAliases":
       { "bi":"0x002232323232" }
     
  }

  afterEach(()=>{
    jest.restoreAllMocks();
  });


  beforeEach(()=>{
    const fsextraMock = jest.spyOn(fs, "readFileSync");
   fsextraMock.mockImplementation((path:string,options:any)=>{return JSON.stringify(sfdx_project);});
  })


  it("Get the package id of an unlocked package",()=>{
    expect(ManifestHelpers.getPackageId(sfdx_project,"bi")).toBe("0x002232323232");
  });

  it("Throws an error, if the package id is missing in PackageAlias",()=>{
    expect(()=>{ManifestHelpers.getPackageId(sfdx_project,"bi2")}).toThrowError("No Package Id found in sfdx-project.json. Please ensure package alias have the package added");
  });

   
 it("Fetches all the package", ()=>{ 
   const manifestHelperMock = jest.spyOn(ManifestHelpers, "getSFDXPackageManifest");
   manifestHelperMock.mockImplementation((projectDirectory:string)=>{
     return sfdx_project
   });
    expect(ManifestHelpers.getAllPackages(null)).toStrictEqual(["temp","core","mass-dataload","access-mgmt","bi"]);
 });


 it("Get manifest, provided a directory",()=>{
  
  expect(ManifestHelpers.getSFDXPackageManifest(null)).toStrictEqual(sfdx_project);
 });


 it("Gets the type of a package",()=>{
  expect(ManifestHelpers.getPackageType(sfdx_project,"bi")).toBe("Unlocked");
  expect(ManifestHelpers.getPackageType(sfdx_project,"core")).toBe("Source");
  expect(ManifestHelpers.getPackageType(sfdx_project,"mass-dataload")).toBe("Data"); 
 });

 it("Gets the package descriptor of a provided package,provided directory",()=>{
  let corePackage=  {
    "path": "packages/domains/core",
    "package": "core",
    "default": false,
    "versionName": "covax",
    "versionNumber": "1.0.0.0"  
  };
  expect(ManifestHelpers.getSFDXPackageDescriptor(null,"core")).toStrictEqual(corePackage);
 });

 it("Gets the package descriptor of a provided package",()=>{
  let corePackage=  {
    "path": "packages/domains/core",
    "package": "core",
    "default": false,
    "versionName": "covax",
    "versionNumber": "1.0.0.0"  
  };
  expect(ManifestHelpers.getPackageDescriptorFromConfig("core",sfdx_project)).toStrictEqual(corePackage);
 });

 it("Gets the default package, provided directory",()=>{
  let defaultPackage=    {
    "path": "packages/temp",
    "default": true,
    "package": "temp",
    "versionName": "temp",
    "versionNumber": "1.0.0.0",
    "ignoreOnStage": ["prepare","validate","build"]
  }

  expect(ManifestHelpers.getDefaultSFDXPackageDescriptor(null)).toStrictEqual(defaultPackage);
 });


 it("Cleans any other package, than the one provided",()=>{

  let cleaned_sfdx_project={
    "packageDirectories": [
      {
        "path": "packages/temp",
        "default": true,
        "package": "temp",
        "versionName": "temp",
        "versionNumber": "1.0.0.0",
        "ignoreOnStage": ["prepare","validate","build"]
      } 
    ],
    "namespace": "",
    "sfdcLoginUrl": "https://login.salesforce.com",
    "sourceApiVersion": "50.0",
     "packageAliases":
       { "bi":"0x002232323232" } 
  }

  expect(ManifestHelpers.cleanupMPDFromManifest(null,"temp")).toStrictEqual(cleaned_sfdx_project);
 });



});
