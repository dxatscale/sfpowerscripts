import { jest, expect } from "@jest/globals";
import { DeploymentCommandStatus } from "../../src/sfdxwrappers/DeploymentCommandStatus";
import DeploymentStatusImpl from "../../src/sfdxwrappers/DeploymentStatusImpl";

let commmandOutput: string = "";
jest.mock("../../src/utils/ExecuteCommand", () => {
  class ExecuteCommand {
    constructor() {}
    execCommand = function (
      command: string,
      workingdirectory: string
    ): Promise<any> {
      return new Promise((resolve, reject) => {
        resolve(commmandOutput);
      });
    };
  }
  return ExecuteCommand;
});

describe("Given a deployment id and a target org, it should retrive the status of the deployment", () => {
  it("On a successful deployment,return status with succeeded", async () => {
    let deploymentID = "0Af0w00000JYczhCAD";
    let targetOrg = "testuser@test.com";

    commmandOutput = JSON.stringify(successReturnedFromCLI);
    let deploymentStatusImpl: DeploymentStatusImpl = new DeploymentStatusImpl(
      targetOrg,
      deploymentID
    );
    let deploymentStatus = await deploymentStatusImpl.exec();
    expect(deploymentStatus.status).toEqual(DeploymentCommandStatus.SUCCEEDED);
    expect(deploymentStatus.result.numberComponentsDeployed).toEqual(
      successReturnedFromCLI.result.numberComponentsDeployed
    );
    expect(deploymentStatus.result.numberComponentsTotal).toEqual(
      successReturnedFromCLI.result.numberComponentsTotal
    );
    expect(deploymentStatus.result).toEqual(successReturnedFromCLI.result);
  });

  it("On a failed deployment,return status with failed", async () => {
    let deploymentID = "0Af0w00000JYczhCAD";
    let targetOrg = "testuser@test.com";

    commmandOutput = JSON.stringify(failureReturnedFromCLI);
    let deploymentStatusImpl: DeploymentStatusImpl = new DeploymentStatusImpl(
      targetOrg,
      deploymentID
    );
    let deploymentStatus = await deploymentStatusImpl.exec();
    expect(deploymentStatus.status).toEqual(DeploymentCommandStatus.FAILED);
    expect(deploymentStatus.result).toEqual(failureReturnedFromCLI.result);
  });

  it("On an inprogress deployment,return status with inprogress", async () => {
    let deploymentID = "0Af0w00000JYczhCAD";

    let targetOrg = "testuser@test.com";
    commmandOutput = JSON.stringify(inProgressReturnedFromCLI);
    let deploymentStatusImpl: DeploymentStatusImpl = new DeploymentStatusImpl(
      targetOrg,
      deploymentID
    );
    let deploymentStatus = await deploymentStatusImpl.exec();
    expect(deploymentStatus.status).toEqual(DeploymentCommandStatus.INPROGRESS);
    expect(deploymentStatus.result.numberComponentsDeployed).toEqual(
      inProgressReturnedFromCLI.result.numberComponentsDeployed
    );
    expect(deploymentStatus.result.numberComponentsTotal).toEqual(
      inProgressReturnedFromCLI.result.numberComponentsTotal
    );
    expect(deploymentStatus.result).toEqual(inProgressReturnedFromCLI.result);
  });
});

let successReturnedFromCLI = {
  status: 0,
  result: {
    checkOnly: false,
    completedDate: "2021-01-05T08:28:08.000Z",
    createdBy: "0050w000002Do1f",
    createdByName: "User User",
    createdDate: "2021-01-05T08:28:00.000Z",
    details: {
      componentSuccesses: [
        {
          changed: "false",
          componentType: "CustomField",
          created: "false",
          createdDate: "2021-01-05T08:28:05.000Z",
          deleted: "false",
          fileName: "mdapi/objects/Space__c.object",
          fullName: "Space__c.Market__c",
          id: "00N0w000004CfeLEAS",
          success: "true",
        },
        {
          changed: "false",
          componentType: "CustomField",
          created: "false",
          createdDate: "2021-01-05T08:28:05.000Z",
          deleted: "false",
          fileName: "mdapi/objects/Contact.object",
          fullName: "Contact.Reservation_Status__c",
          id: "00N0w000004CfeMEAS",
          success: "true",
        },
      ],
      runTestResult: {
        numFailures: "0",
        numTestsRun: "0",
        totalTime: "0.0",
      },
    },
    done: true,
    id: "0Af0w00000JYczhCAD",
    ignoreWarnings: false,
    lastModifiedDate: "2021-01-05T08:28:08.000Z",
    numberComponentErrors: 0,
    numberComponentsDeployed: 45,
    numberComponentsTotal: 45,
    numberTestErrors: 0,
    numberTestsCompleted: 0,
    numberTestsTotal: 0,
    rollbackOnError: true,
    runTestsEnabled: false,
    startDate: "2021-01-05T08:28:00.000Z",
    status: "Succeeded",
    success: true,
  },
};

let failureReturnedFromCLI = {
  status: 1,
  result: {
    checkOnly: false,
    completedDate: "2021-01-05T08:52:16.000Z",
    createdBy: "0050w000002Do1f",
    createdByName: "User User",
    createdDate: "2021-01-05T08:52:08.000Z",
    details: {
      componentFailures: [
        {
          changed: "false",
          componentType: "PermissionSet",
          created: "false",
          createdDate: "2021-01-05T08:52:16.000Z",
          deleted: "false",
          fileName: "mdapi/permissionsets/EasySpacesObjects.permissionset",
          fullName: "EasySpacesObjects",
          problem:
            "In field: field - no CustomField named Account.BillingAddress2 found",
          problemType: "Error",
          success: "false",
        },
      ],
      componentSuccesses: [
        {
          changed: "false",
          componentType: "CustomField",
          created: "false",
          createdDate: "2021-01-05T08:52:12.000Z",
          deleted: "false",
          fileName: "mdapi/objects/Market__c.object",
          fullName: "Market__c.City__c",
          id: "00N0w000004CfeNEAS",
          success: "true",
        },
      ],
      runTestResult: {
        numFailures: "0",
        numTestsRun: "0",
        totalTime: "0.0",
      },
    },
    done: true,
    id: "0Af0w00000JYd5QCAT",
    ignoreWarnings: false,
    lastModifiedDate: "2021-01-05T08:52:16.000Z",
    numberComponentErrors: 1,
    numberComponentsDeployed: 44,
    numberComponentsTotal: 45,
    numberTestErrors: 0,
    numberTestsCompleted: 0,
    numberTestsTotal: 0,
    rollbackOnError: true,
    runTestsEnabled: false,
    startDate: "2021-01-05T08:52:08.000Z",
    status: "Failed",
    success: false,
  },
  stack:
    "mdapiDeployFailed: The metadata deploy operation failed.\n    at ALMError (C:\\Users\\azlam.abdulsalam\\AppData\\Local\\sfdx\\node_modules\\salesforce-alm\\dist\\lib\\core\\almError.js:50:19)\n    at MdDeployReportApi._throwErrorIfDeployFailed (C:\\Users\\azlam.abdulsalam\\AppData\\Local\\sfdx\\node_modules\\salesforce-alm\\dist\\lib\\mdapi\\mdapiDeployReportApi.js:343:25)\n    at C:\\Users\\azlam.abdulsalam\\AppData\\Local\\sfdx\\node_modules\\salesforce-alm\\dist\\lib\\mdapi\\mdapiDeployReportApi.js:299:34\n    at tryCatcher (C:\\Users\\azlam.abdulsalam\\AppData\\Local\\sfdx\\node_modules\\salesforce-alm\\node_modules\\bluebird\\js\\release\\util.js:16:23)\n    at Promise._settlePromiseFromHandler (C:\\Users\\azlam.abdulsalam\\AppData\\Local\\sfdx\\node_modules\\salesforce-alm\\node_modules\\bluebird\\js\\release\\promise.js:547:31)\n    at Promise._settlePromise (C:\\Users\\azlam.abdulsalam\\AppData\\Local\\sfdx\\node_modules\\salesforce-alm\\node_modules\\bluebird\\js\\release\\promise.js:604:18)\n    at Promise._settlePromise0 (C:\\Users\\azlam.abdulsalam\\AppData\\Local\\sfdx\\node_modules\\salesforce-alm\\node_modules\\bluebird\\js\\release\\promise.js:649:10)\n    at Promise._settlePromises (C:\\Users\\azlam.abdulsalam\\AppData\\Local\\sfdx\\node_modules\\salesforce-alm\\node_modules\\bluebird\\js\\release\\promise.js:729:18)\n    at _drainQueueStep (C:\\Users\\azlam.abdulsalam\\AppData\\Local\\sfdx\\node_modules\\salesforce-alm\\node_modules\\bluebird\\js\\release\\async.js:93:12)\n    at _drainQueue (C:\\Users\\azlam.abdulsalam\\AppData\\Local\\sfdx\\node_modules\\salesforce-alm\\node_modules\\bluebird\\js\\release\\async.js:86:9)\n    at Async._drainQueues (C:\\Users\\azlam.abdulsalam\\AppData\\Local\\sfdx\\node_modules\\salesforce-alm\\node_modules\\bluebird\\js\\release\\async.js:102:5)\n    at Immediate.Async.drainQueues [as _onImmediate] (C:\\Users\\azlam.abdulsalam\\AppData\\Local\\sfdx\\node_modules\\salesforce-alm\\node_modules\\bluebird\\js\\release\\async.js:15:14)\n    at processImmediate (internal/timers.js:456:21)\nOuter stack:\n    at Function.wrap (C:\\Users\\azlam.abdulsalam\\AppData\\Local\\sfdx\\node_modules\\salesforce-alm\\node_modules\\@salesforce\\core\\lib\\sfdxError.js:171:27)\n    at MdapiDeployReportCommand.catch (C:\\Users\\azlam.abdulsalam\\AppData\\Local\\sfdx\\node_modules\\salesforce-alm\\dist\\ToolbeltCommand.js:248:46)\n    at async MdapiDeployReportCommand._run (C:\\Users\\azlam.abdulsalam\\AppData\\Local\\sfdx\\node_modules\\salesforce-alm\\node_modules\\@salesforce\\command\\lib\\sfdxCommand.js:97:13)\n    at async Config.runCommand (C:\\Users\\azlam.abdulsalam\\AppData\\Roaming\\npm\\node_modules\\sfdx-cli\\node_modules\\@oclif\\config\\lib\\config.js:173:24)\n    at async Main.run (C:\\Users\\azlam.abdulsalam\\AppData\\Roaming\\npm\\node_modules\\sfdx-cli\\node_modules\\@oclif\\command\\lib\\main.js:27:9)\n    at async Main._run (C:\\Users\\azlam.abdulsalam\\AppData\\Roaming\\npm\\node_modules\\sfdx-cli\\node_modules\\@oclif\\command\\lib\\command.js:43:20)\n    at async Object.run (C:\\Users\\azlam.abdulsalam\\AppData\\Roaming\\npm\\node_modules\\sfdx-cli\\dist\\cli.js:32:20)",
  warnings: [],
};

let inProgressReturnedFromCLI = {
  status: 0,
  result: {
    checkOnly: false,
    createdBy: "0050w000002Do1f",
    createdByName: "User User",
    createdDate: "2021-01-05T09:04:41.000Z",
    details: {
      componentSuccesses: [
        {
          changed: "false",
          componentType: "ApexClass",
          created: "false",
          createdDate: "2021-01-05T09:04:47.000Z",
          deleted: "false",
          fileName: "mdapi2/classes/ReservationManager.cls",
          fullName: "ReservationManager",
          id: "01p0w000001qr8MAAQ",
          success: "true",
        },
      ],
      runTestResult: {
        failures: {
          id: "01p0w000001qr8KAAQ",
          message:
            "System.QueryException: Insufficient permissions: secure query included inaccessible field",
          methodName: "canFetchRelatedSpaces",
          name: "MarketServicesTest",
          namespace: {
            $: {
              "xsi:nil": "true",
            },
          },
          packageName: "MarketServicesTest",
          stackTrace:
            "Class.MarketServices.getRelatedSpaces: line 4, column 1\nClass.MarketServicesTest.canFetchRelatedSpaces: line 37, column 1",
          time: "45.0",
          type: "Class",
        },
        numFailures: "1",
        numTestsRun: "0",
        totalTime: "0.0",
      },
    },
    done: false,
    id: "0Af0w00000JYdPCCA1",
    ignoreWarnings: false,
    lastModifiedDate: "2021-01-05T09:04:56.000Z",
    numberComponentErrors: 0,
    numberComponentsDeployed: 32,
    numberComponentsTotal: 32,
    numberTestErrors: 0,
    numberTestsCompleted: 1,
    numberTestsTotal: 6,
    rollbackOnError: true,
    runTestsEnabled: true,
    startDate: "2021-01-05T09:04:42.000Z",
    stateDetail: "Running Test: MarketServicesTest.canFetchRelatedSpaces",
    status: "InProgress",
    success: false,
    timedOut: true,
  },
};
