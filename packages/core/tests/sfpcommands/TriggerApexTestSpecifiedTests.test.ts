
import { jest, expect } from "@jest/globals";
import { RunSpecifiedTestsOption, TestOptions } from "../../src/sfdxwrappers/TestOptions";
import fs from "fs-extra";
import { CoverageOptions } from "../../src/apex/coverage/IndividualClassCoverage";
import TriggerApexTests from "../../src/sfpcommands/apextest/TriggerApexTests";
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


describe("Given an org, trigger apex tests,along with specified test and coverage options",()=>{

  it("Run specific tests, but do not validate individual coverage for  classes",()=>{
      
   
    const fsextraMock = jest.spyOn(fs, "readFileSync");
    fsextraMock.mockImplementationOnce(
      (path: any, options: string | { encoding?: string; flag?: string }) => {
        return "7070w00000X2jWS";
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

    let testOptions:RunSpecifiedTestsOption = new RunSpecifiedTestsOption(60,".tests","MarketServicesTest");
    let coverageOptions:CoverageOptions ={
      isIndividualClassCoverageToBeValidated:false,
      coverageThreshold:75,
      isPackageCoverageToBeValidated:false
    }
    let triggerApexTests:TriggerApexTests = new TriggerApexTests("test@test.com",testOptions,coverageOptions,null,new ConsoleLogger());

    expect(triggerApexTests.exec()).resolves.toStrictEqual({
      result: true,
      id: `7070w00000X2jWS`,
      message: `Test execution succesfully completed`
    });

  });


  it("Run specific tests, and validate individual coverage for  classes",()=>{
       
    const fsextraMock = jest.spyOn(fs, "readFileSync");
    //Retun Test Id
    fsextraMock.mockImplementationOnce(
      (path: any, options: string | { encoding?: string; flag?: string }) => {
        return "7070w00000X2jWS";
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

    let testOptions:RunSpecifiedTestsOption = new RunSpecifiedTestsOption(60,".tests","MarketServicesTest");
    let coverageOptions:CoverageOptions ={
      isIndividualClassCoverageToBeValidated:true,
      coverageThreshold:75,
      isPackageCoverageToBeValidated:false
    }
    let triggerApexTests:TriggerApexTests = new TriggerApexTests("test@test.com",testOptions,coverageOptions,null,new ConsoleLogger());

    expect(triggerApexTests.exec()).resolves.toStrictEqual({
      result: true,
      id: `7070w00000X2jWS`,
      message: `All classes in this test run meet the required coverage threshold`
    });

  });


  it("Run specific tests, and return failure if the test fails",()=>{
       
    const fsextraMock = jest.spyOn(fs, "readFileSync");
    //Retun Test Id
    fsextraMock.mockImplementationOnce(
      (path: any, options: string | { encoding?: string; flag?: string }) => {
        return "7070w00000X2jWS";
      }
    ).mockImplementationOnce(
      (path: any, options: string | { encoding?: string; flag?: string }) => {
        return JSON.stringify(specifiedTestsFailedOutput);
      }
    )

    let testOptions:RunSpecifiedTestsOption = new RunSpecifiedTestsOption(60,".tests","MarketServicesTest");
    let coverageOptions:CoverageOptions ={
      isIndividualClassCoverageToBeValidated:false,
      coverageThreshold:75,
      isPackageCoverageToBeValidated:false
    }
    let triggerApexTests:TriggerApexTests = new TriggerApexTests("test@test.com",testOptions,coverageOptions,null,new ConsoleLogger());

    expect(triggerApexTests.exec()).resolves.toStrictEqual({
      result: false,
      id: `7070w00000X2jWS`,
      message: `Test Execution failed`
    });

  });


  it("Run specific tests along with coverage, and return failure if the coverage fails",()=>{
       
    const fsextraMock = jest.spyOn(fs, "readFileSync");
    fsextraMock.mockImplementationOnce(
        (path: any, options: string | { encoding?: string; flag?: string }) => {
          return "7070w00000X2jWS";
        }
      ).mockImplementationOnce(
        (path: any, options: string | { encoding?: string; flag?: string }) => {
          return JSON.stringify(specifiedTestsSuccessFulOutput);
        }
      ).mockImplementationOnce(
        (path: any, options: string | { encoding?: string; flag?: string }) => {
          return JSON.stringify(specifiedTestsFailureCoverageReport);
        }
      );
    let testOptions:RunSpecifiedTestsOption = new RunSpecifiedTestsOption(60,".tests","MarketServicesTest");
    let coverageOptions:CoverageOptions ={
      isIndividualClassCoverageToBeValidated:true,
      coverageThreshold:75,
      isPackageCoverageToBeValidated:false
    }
    let triggerApexTests:TriggerApexTests = new TriggerApexTests("test@test.com",testOptions,coverageOptions,null,new ConsoleLogger());

    expect(triggerApexTests.exec()).resolves.toStrictEqual({
      result: false,
      id: `7070w00000X2jWS`,
      message: `There are classes which do not satisfy the individual coverage requirements`
    });

  });



});



let specifiedTestsFailedOutput={
    "summary": {
        "outcome": "Failed",
        "testsRan": 1,
        "passing": 0,
        "failing": 1,
        "skipped": 0,
        "passRate": "90%",
        "failRate": "10%",
        "testStartTime": "Jan 11, 2021 2:51 PM",
        "testExecutionTime": "113 ms",
        "testTotalTime": "113 ms",
        "commandTime": "14404 ms",
        "hostname": "https://site-computing-8127-dev-ed.cs75.my.salesforce.com/",
        "orgId": "00D0w0000000gYQEAY",
        "username": "test-ibel3stjdggv@example.com",
        "testRunId": "7070w00000X2jWS",
        "userId": "0050w000002KhdRAAS",
        "testRunCoverage": "97%",
        "orgWideCoverage": "97%"
    },
    "tests": [
        {
            "attributes": {
                "type": "ApexTestResult",
                "url": "/services/data/v50.0/tooling/sobjects/ApexTestResult/07M0w000002irgLEAQ"
            },
            "Id": "07M0w000002irgLEAQ",
            "QueueItemId": "7090w000000Q9w1AAC",
            "StackTrace": null,
            "Message": null,
            "AsyncApexJobId": "7070w00000X2jWSAAZ",
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
            "RunTime": 113,
            "FullName": "MarketServicesTest.canFetchRelatedSpaces"
        }
    ]
  };

let specifiedTestsSuccessFulOutput={
  "summary": {
      "outcome": "Passed",
      "testsRan": 1,
      "passing": 1,
      "failing": 0,
      "skipped": 0,
      "passRate": "100%",
      "failRate": "0%",
      "testStartTime": "Jan 11, 2021 2:51 PM",
      "testExecutionTime": "113 ms",
      "testTotalTime": "113 ms",
      "commandTime": "14404 ms",
      "hostname": "https://site-computing-8127-dev-ed.cs75.my.salesforce.com/",
      "orgId": "00D0w0000000gYQEAY",
      "username": "test-ibel3stjdggv@example.com",
      "testRunId": "7070w00000X2jWS",
      "userId": "0050w000002KhdRAAS",
      "testRunCoverage": "97%",
      "orgWideCoverage": "97%"
  },
  "tests": [
      {
          "attributes": {
              "type": "ApexTestResult",
              "url": "/services/data/v50.0/tooling/sobjects/ApexTestResult/07M0w000002irgLEAQ"
          },
          "Id": "07M0w000002irgLEAQ",
          "QueueItemId": "7090w000000Q9w1AAC",
          "StackTrace": null,
          "Message": null,
          "AsyncApexJobId": "7070w00000X2jWSAAZ",
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
          "RunTime": 113,
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
]

let specifiedTestsFailureCoverageReport=[
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
        "coveredPercent": 60
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
  ]