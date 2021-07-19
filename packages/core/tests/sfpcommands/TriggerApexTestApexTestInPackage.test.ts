
import { jest, expect } from "@jest/globals";
import { TestOptions } from "../../src/sfdxwrappers/TestOptions";
import fs from "fs-extra";
import { CoverageOptions } from "../../src/apex/coverage/IndividualClassCoverage";
import TriggerApexTests from "../../src/sfpcommands/apextest/TriggerApexTests";
import { RunAllTestsInPackageOptions } from "../../src/sfpcommands/apextest/ExtendedTestOptions";
import SFPPackage, { ApexClasses } from "../../src/package/SFPPackage";
import { ConsoleLogger } from "../../src/logger/SFPLogger";


let result:"";
jest.mock("../../src/sfdxwrappers/TriggerApexTestImpl", () => {
  class TriggerApexTestImpl {
    public constructor(
      target_org: string,
      project_directory: string,
      private testOptions: TestOptions
    ) {
    }
    exec = jest
      .fn()
      .mockReturnValueOnce(Promise.resolve(result))
   getGeneratedSFDXCommandWithParams=jest.fn();
  }
  return TriggerApexTestImpl;
});

let packageType="";
jest.mock("../../src/package/SFPPackage", () => {
    class SFPPackage {
   
      public static async buildPackageFromProjectConfig(
        projectDirectory: string,
        sfdx_package: string,
        configFilePath?: string,
        packageLogger?: any
      ) {
        let sfpPackage: SFPPackage = new SFPPackage();
        return sfpPackage;
      }
      
      get apexClassWithOutTestClasses(): ApexClasses {
        return new Array<string>("CustomerServices","MarketServices");
      }

      get apexTestClassses(): ApexClasses {
        return new Array<string>("CustomerServicesTest","MarketServicesTest","TestDataFactory");
      }
    
      get triggers(): ApexClasses {
        return null;
      }

      get packageType():string {
        return packageType;
      }
    }
    return SFPPackage;
  });
  


describe("Given an org, trigger apex tests,along with tests in package options and coverage options",()=>{

  it("Run all the tests in unlocked package, but do not validate coverage for the package",async ()=>{
      
   
    const fsextraMock = jest.spyOn(fs, "readFileSync");
    fsextraMock.mockImplementationOnce(
      (path: any, options: string | { encoding?: string; flag?: string }) => {
        return "7070w00000X44Ou";
      }
    ).mockImplementationOnce(
      (path: any, options: string | { encoding?: string; flag?: string }) => {
        return JSON.stringify(specifiedTestsSuccessFulOutput);
      }
    ).mockImplementationOnce(
      (path: any, options: string | { encoding?: string; flag?: string }) => {
        return JSON.stringify(specifiedTestsCoverageReport);
      }
    );


    packageType="Unlocked";
    let sfppackage:SFPPackage = await SFPPackage.buildPackageFromProjectConfig(null,"ESBaseCodeLWC",null,null);
    let testOptions:RunAllTestsInPackageOptions = new RunAllTestsInPackageOptions(sfppackage,60,".tests");

  
    let coverageOptions:CoverageOptions ={
      isIndividualClassCoverageToBeValidated:false,
      coverageThreshold:75,
      isPackageCoverageToBeValidated:false
    }
    let triggerApexTests:TriggerApexTests = new TriggerApexTests("test@test.com",testOptions,coverageOptions,null,new ConsoleLogger());

    expect(triggerApexTests.exec()).resolves.toStrictEqual({
      result: true,
      id: `7070w00000X44Ou`,
      message: `Test execution succesfully completed`
    });

  });



  it("Run all the tests in unlocked package, and validate coverage for the package",async ()=>{
      
   
    const fsextraMock = jest.spyOn(fs, "readFileSync");
    fsextraMock.mockImplementationOnce(
      (path: any, options: string | { encoding?: string; flag?: string }) => {
        return "7070w00000X44Ou";
      }
    ).mockImplementationOnce(
      (path: any, options: string | { encoding?: string; flag?: string }) => {
        return JSON.stringify(specifiedTestsSuccessFulOutput);
      }
    ).mockImplementationOnce(
      (path: any, options: string | { encoding?: string; flag?: string }) => {
        return JSON.stringify(specifiedTestsCoverageReport);
      }
    );


    packageType="Unlocked";
    let sfppackage:SFPPackage = await SFPPackage.buildPackageFromProjectConfig(null,"ESBaseCodeLWC",null,null);
    let testOptions:RunAllTestsInPackageOptions = new RunAllTestsInPackageOptions(sfppackage,60,".tests");

  
    let coverageOptions:CoverageOptions ={
      isIndividualClassCoverageToBeValidated:false,
      coverageThreshold:75,
      isPackageCoverageToBeValidated:true
    }
    let triggerApexTests:TriggerApexTests = new TriggerApexTests("test@test.com",testOptions,coverageOptions,null,new ConsoleLogger());

    expect(triggerApexTests.exec()).resolves.toStrictEqual({
      result: true,
      id: `7070w00000X44Ou`,
      message: `Package overall coverage is greater than 75%`
    });

  });


  it("Run all the tests in unlocked package, and validate coverage for the package, for a package that do not meet requirements",async ()=>{
      
   
    const fsextraMock = jest.spyOn(fs, "readFileSync");
    fsextraMock.mockImplementationOnce(
      (path: any, options: string | { encoding?: string; flag?: string }) => {
        return "7070w00000X44Ou";
      }
    ).mockImplementationOnce(
      (path: any, options: string | { encoding?: string; flag?: string }) => {
        return JSON.stringify(specifiedTestsSuccessFulOutput);
      }
    ).mockImplementationOnce(
      (path: any, options: string | { encoding?: string; flag?: string }) => {
        return JSON.stringify(failedSpecifiedTestsCoverageReport);
      }
    );


    packageType="Unlocked";
    let sfppackage:SFPPackage = await SFPPackage.buildPackageFromProjectConfig(null,"ESBaseCodeLWC",null,null);
    let testOptions:RunAllTestsInPackageOptions = new RunAllTestsInPackageOptions(sfppackage,60,".tests");

  
    let coverageOptions:CoverageOptions ={
      isIndividualClassCoverageToBeValidated:false,
      coverageThreshold:75,
      isPackageCoverageToBeValidated:true
    }
    let triggerApexTests:TriggerApexTests = new TriggerApexTests("test@test.com",testOptions,coverageOptions,null,new ConsoleLogger());

    expect(triggerApexTests.exec()).resolves.toStrictEqual({
      result: false,
      id: `7070w00000X44Ou`,
      message: `The package has an overall coverage of 29%, which does not meet the required overall coverage of 75%`
    });

  });

  
  it("Run all the tests in source package, and validate coverage for the package along with individual class coverage",async ()=>{
      
   
    const fsextraMock = jest.spyOn(fs, "readFileSync");
    fsextraMock.mockImplementationOnce(
      (path: any, options: string | { encoding?: string; flag?: string }) => {
        return "7070w00000X44Ou";
      }
    ).mockImplementationOnce(
      (path: any, options: string | { encoding?: string; flag?: string }) => {
        return JSON.stringify(specifiedTestsSuccessFulOutput);
      }
    ).mockImplementationOnce(
      (path: any, options: string | { encoding?: string; flag?: string }) => {
        return JSON.stringify(specifiedTestsCoverageReport);
      }
    );


    packageType="Source";
    let sfppackage:SFPPackage = await SFPPackage.buildPackageFromProjectConfig(null,"ESBaseCodeLWC",null,null);
    let testOptions:RunAllTestsInPackageOptions = new RunAllTestsInPackageOptions(sfppackage,60,".tests");

  
    let coverageOptions:CoverageOptions ={
      isIndividualClassCoverageToBeValidated:true,
      coverageThreshold:75,
      isPackageCoverageToBeValidated:true
    }
    let triggerApexTests:TriggerApexTests = new TriggerApexTests("test@test.com",testOptions,coverageOptions,null,new ConsoleLogger());

    expect(triggerApexTests.exec()).resolves.toStrictEqual({
      result: true,
      id: `7070w00000X44Ou`,
      message: `Individidual coverage of classes is greater than 75%`
    });

  });





});




let specifiedTestsSuccessFulOutput={
  "summary": {
      "outcome": "Passed",
      "testsRan": 2,
      "passing": 2,
      "failing": 0,
      "skipped": 0,
      "passRate": "100%",
      "failRate": "0%",
      "testStartTime": "Jan 13, 2021 11:32 AM",
      "testExecutionTime": "973 ms",
      "testTotalTime": "973 ms",
      "commandTime": "17010 ms",
      "hostname": "https://site-computing-8127-dev-ed.cs75.my.salesforce.com/",
      "orgId": "00D0w0000000gYQEAY",
      "username": "test-ibel3stjdggv@example.com",
      "testRunId": "7070w00000X44Ou",
      "userId": "0050w000002KhdRAAS",
      "testRunCoverage": "97%",
      "orgWideCoverage": "97%"
  },
  "tests": [
      {
          "attributes": {
              "type": "ApexTestResult",
              "url": "/services/data/v50.0/tooling/sobjects/ApexTestResult/07M0w000002j2JrEAI"
          },
          "Id": "07M0w000002j2JrEAI",
          "QueueItemId": "7090w000000QB7GAAW",
          "StackTrace": null,
          "Message": null,
          "AsyncApexJobId": "7070w00000X44OuAAJ",
          "MethodName": "canFetchCustomerFields",
          "Outcome": "Pass",
          "ApexClass": {
              "attributes": {
                  "type": "ApexClass",
                  "url": "/services/data/v50.0/tooling/sobjects/ApexClass/01p0w000001n1SeAAI"
              },
              "Id": "01p0w000001n1SeAAI",
              "Name": "CustomerServicesTest",
              "NamespacePrefix": null
          },
          "RunTime": 815,
          "FullName": "CustomerServicesTest.canFetchCustomerFields"
      },
      {
          "attributes": {
              "type": "ApexTestResult",
              "url": "/services/data/v50.0/tooling/sobjects/ApexTestResult/07M0w000002j2K1EAI"
          },
          "Id": "07M0w000002j2K1EAI",
          "QueueItemId": "7090w000000QB7FAAW",
          "StackTrace": null,
          "Message": null,
          "AsyncApexJobId": "7070w00000X44OuAAJ",
          "MethodName": "canFetchRelatedSpaces",
          "Outcome": "Pass",
          "ApexClass": {
              "attributes": {
                  "type": "ApexClass",
                  "url": "/services/data/v50.0/tooling/sobjects/ApexClass/01p0w000001n1SgAAI"
              },
              "Id": "01p0w000001n1SgAAI",
              "Name": "MarketServicesTest",
              "NamespacePrefix": null
          },
          "RunTime": 158,
          "FullName": "MarketServicesTest.canFetchRelatedSpaces"
      }
  ]
};

let specifiedTestsCoverageReport=[
  {
      "id": "01p0w000001n1SdAAI",
      "name": "CustomerServices",
      "totalLines": 31,
      "lines": {
          "3": 1,
          "4": 1,
          "5": 1,
          "13": 1,
          "15": 1,
          "16": 1,
          "17": 1,
          "18": 1,
          "19": 1,
          "20": 1,
          "21": 1,
          "22": 1,
          "25": 1,
          "31": 1,
          "34": 1,
          "37": 1,
          "40": 1,
          "43": 1,
          "46": 1,
          "49": 1,
          "57": 1,
          "58": 1,
          "59": 1,
          "60": 1,
          "61": 1,
          "62": 1,
          "63": 1,
          "64": 1,
          "65": 1,
          "66": 1,
          "67": 1
      },
      "totalCovered": 31,
      "coveredPercent": 100
  },
  {
      "id": "01p0w000001n1SfAAI",
      "name": "MarketServices",
      "totalLines": 3,
      "lines": {
          "3": 1,
          "4": 1,
          "16": 1
      },
      "totalCovered": 3,
      "coveredPercent": 100
  },
  {
      "id": "01p0w000001n1SjAAI",
      "name": "ReservationManagerController",
      "totalLines": 32,
      "lines": {
          "4": 1,
          "7": 1,
          "8": 1,
          "17": 1,
          "22": 1,
          "23": 1,
          "25": 1,
          "26": 1,
          "27": 1,
          "28": 1,
          "29": 1,
          "30": 1,
          "31": 1,
          "32": 1,
          "33": 1,
          "34": 1,
          "35": 1,
          "36": 1,
          "37": 1,
          "39": 1,
          "41": 1,
          "42": 1,
          "43": 1,
          "44": 1,
          "45": 1,
          "46": 1,
          "47": 1,
          "48": 1,
          "50": 1,
          "52": 1,
          "56": 1,
          "57": 1
      },
      "totalCovered": 32,
      "coveredPercent": 100
  },
  {
      "id": "01p0w000001n1SiAAI",
      "name": "ReservationManager",
      "totalLines": 28,
      "lines": {
          "3": 1,
          "6": 1,
          "7": 1,
          "8": 1,
          "9": 1,
          "10": 1,
          "12": 1,
          "13": 1,
          "15": 1,
          "20": 1,
          "24": 1,
          "25": 1,
          "26": 1,
          "27": 1,
          "29": 1,
          "30": 1,
          "31": 1,
          "34": 1,
          "35": 1,
          "36": 1,
          "37": 1,
          "39": 1,
          "40": 1,
          "41": 1,
          "42": 1,
          "43": 0,
          "44": 0,
          "48": 1
      },
      "totalCovered": 26,
      "coveredPercent": 93
  }
];


let failedSpecifiedTestsCoverageReport=[
    {
        "id": "01p0w000001n1SdAAI",
        "name": "CustomerServices",
        "totalLines": 31,
        "lines": {
            "3": 1,
            "4": 1,
            "5": 1,
            "13": 1,
            "15": 1,
            "16": 1,
            "17": 1,
            "18": 1,
            "19": 1,
            "20": 1,
            "21": 1,
            "22": 1,
            "25": 1,
            "31": 1,
            "34": 1,
            "37": 1,
            "40": 1,
            "43": 1,
            "46": 1,
            "49": 1,
            "57": 1,
            "58": 1,
            "59": 1,
            "60": 1,
            "61": 1,
            "62": 1,
            "63": 1,
            "64": 1,
            "65": 1,
            "66": 1,
            "67": 1
        },
        "totalCovered": 10,
        "coveredPercent": 60
    },
    {
        "id": "01p0w000001n1SfAAI",
        "name": "MarketServices",
        "totalLines": 3,
        "lines": {
            "3": 0,
            "4": 0,
            "16": 0
        },
        "totalCovered": 0,
        "coveredPercent": 60
    },
    {
        "id": "01p0w000001n1SjAAI",
        "name": "ReservationManagerController",
        "totalLines": 32,
        "lines": {
            "4": 1,
            "7": 1,
            "8": 1,
            "17": 1,
            "22": 1,
            "23": 1,
            "25": 1,
            "26": 1,
            "27": 1,
            "28": 1,
            "29": 1,
            "30": 1,
            "31": 1,
            "32": 1,
            "33": 0,
            "34": 0,
            "35": 0,
            "36": 0,
            "37": 0,
            "39": 0,
            "41": 0,
            "42": 0,
            "43": 0,
            "44": 0,
            "45": 0,
            "46": 1,
            "47": 0,
            "48": 0,
            "50": 0,
            "52": 0,
            "56": 1,
            "57": 1
        },
        "totalCovered": 10,
        "coveredPercent": 60
    },
    {
        "id": "01p0w000001n1SiAAI",
        "name": "ReservationManager",
        "totalLines": 28,
        "lines": {
            "3": 1,
            "6": 1,
            "7": 1,
            "8": 1,
            "9": 1,
            "10": 1,
            "12": 1,
            "13": 0,
            "15": 1,
            "20": 0,
            "24": 1,
            "25": 0,
            "26": 1,
            "27": 0,
            "29": 1,
            "30": 0,
            "31": 1,
            "34": 0,
            "35": 1,
            "36": 0,
            "37": 1,
            "39": 0,
            "40": 0,
            "41": 0,
            "42": 0,
            "43": 0,
            "44": 0,
            "48": 1
        },
        "totalCovered": 26,
        "coveredPercent": 0
    }
  ];