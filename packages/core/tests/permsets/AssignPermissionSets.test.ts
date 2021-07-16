import child_process = require("child_process");
import AssignPermissionSets from "../../src/permsets/AssignPermissionSets";
import { jest,expect } from "@jest/globals";
import { VoidLogger } from "../../src/logger/SFPLogger";
import { AuthInfo, Connection } from "@salesforce/core";
import { MockTestOrgData, testSetup } from "@salesforce/core/lib/testSetup";

const $$ = testSetup();

jest.mock("../../src/permsets/PermissionSetFetcher", () => {
  class PermissionSetFetcher {
    constructor(private username: string, private conn: Connection) {}
    fetchAllPermsetAssignment(): any[] {
      return [
        {
          attributes: {
            type: "PermissionSetAssignment",
            url:
              "/services/data/v50.0/sobjects/PermissionSetAssignment/0Pa2s000000PC8fCAG",
          },
          Id: "0Pa2s000000PC8fCAG",
          PermissionSet: {
            attributes: {
              type: "PermissionSet",
              url:
                "/services/data/v50.0/sobjects/PermissionSet/0PS2s000000bldoGAA",
            },
            Name: "Salesforce_DX_Permissions",
          },
          Assignee: {
            attributes: {
              type: "User",
              url: "/services/data/v50.0/sobjects/User/0052s000000kuInAAI",
            },
            Username: "test-sfvulqawd2w0@example.com",
          },
        },
        {
          attributes: {
            type: "PermissionSetAssignment",
            url:
              "/services/data/v50.0/sobjects/PermissionSetAssignment/0Pa2s000000PC8aCAG",
          },
          Id: "0Pa2s000000PC8aCAG",
          PermissionSet: {
            attributes: {
              type: "PermissionSet",
              url:
                "/services/data/v50.0/sobjects/PermissionSet/0PS6F000004MA6gWAG",
            },
            Name: "X00ex00000018ozT_128_09_43_34_1",
          },
          Assignee: {
            attributes: {
              type: "User",
              url: "/services/data/v50.0/sobjects/User/0052s000000kuInAAI",
            },
            Username: "test-sfvulqawd2w0@example.com",
          },
        },
      ];
    }
  }
  return PermissionSetFetcher;
});

describe("Given a set of permsets, assign it to the user who is deploying the packages", () => {
  it("should assign a set of  permset, if its not previously assigned", async () => {
    
    const testData = new MockTestOrgData();
    $$.setConfigStubContents('AuthInfoConfig', {
      contents:  await testData.getConfig(),
    });
    const connection: Connection = await Connection.create({
      authInfo:  await AuthInfo.create({ username: testData.username })
    });


    let assignPermSetImpl: AssignPermissionSets = new AssignPermissionSets(
      connection,
      ["test1", "test2"],
      null,
      new VoidLogger()
    );
    const child_processMock = jest.spyOn(child_process, "execSync");
    child_processMock
      .mockImplementationOnce(() => {
        return Buffer.from(`{
          "status": 0,
          "result": {
            "successes": [{
              "name": "test-sfvulqawd2w0@example.com",
              "message": "Succesfully applied the permsets"
            }]
          }
        }`);
      })
      .mockImplementationOnce(() => {
        return Buffer.from(`{
          "status": 0,
          "result": {
            "successes": [{
              "name": "test-sfvulqawd2w0@example.com",
              "message": "Succesfully applied the permsets"
            }]
          }
        }`);
      });

    let results = await assignPermSetImpl.exec();
    expect(results.successfullAssignments).toHaveLength(2);
    expect(results.failedAssignments).toHaveLength(0);

  });


  it("should assign a partial set  of  permset, if any of them fails", async () => {
    
    const testData = new MockTestOrgData();
    $$.setConfigStubContents('AuthInfoConfig', {
      contents:  await testData.getConfig(),
    });
    const connection: Connection = await Connection.create({
      authInfo:  await AuthInfo.create({ username: testData.username })
    });


    let assignPermSetImpl: AssignPermissionSets = new AssignPermissionSets(
      connection,
      ["test1", "test2"],
      null,
      new VoidLogger()
    );
    const child_processMock = jest.spyOn(child_process, "execSync");
    child_processMock
      .mockImplementationOnce(() => {
        return Buffer.from(`{
          "status": 1,
          "result": {
            "successes": [{
              "name": "test-sfvulqawd2w0@example.com",
              "message": "Permset cannot be applied"
            }]
          }
        }`);
      })
      .mockImplementationOnce(() => {
        return Buffer.from(`{
          "status": 0,
          "result": {
            "successes": [{
              "name": "test-sfvulqawd2w0@example.com",
              "message": "Succesfully applied the permsets"
            }]
          }
        }`);
      });

    let results = await assignPermSetImpl.exec();
    expect(results.successfullAssignments).toHaveLength(1);
    expect(results.failedAssignments).toHaveLength(1);
  });


  it("should assign none, if all of them fails", async () => {

    const testData = new MockTestOrgData();
    $$.setConfigStubContents('AuthInfoConfig', {
      contents:  await testData.getConfig(),
    });
    const connection: Connection = await Connection.create({
      authInfo:  await AuthInfo.create({ username: testData.username })
    });

   
    let assignPermSetImpl: AssignPermissionSets = new AssignPermissionSets(
      connection,
      ["test1", "test2"],
      null,
      new VoidLogger()
    );
    const child_processMock = jest.spyOn(child_process, "execSync");
    child_processMock
      .mockImplementationOnce(() => {
        return Buffer.from(`{
          "status": 1,
          "result": {
            "successes": [{
              "name": "test-sfvulqawd2w0@example.com",
              "message": "Permset cannot be applied"
            }]
          }
        }`);
      })
      .mockImplementationOnce(() => {
        return Buffer.from(`{
          "status": 1,
          "result": {
            "successes": [{
              "name": "test-sfvulqawd2w0@example.com",
              "message": "Permset cannot be applied"
            }]
          }
        }`);
      });

    let results = await assignPermSetImpl.exec();
    expect(results.successfullAssignments).toHaveLength(0);
    expect(results.failedAssignments).toHaveLength(2);
  });
});


