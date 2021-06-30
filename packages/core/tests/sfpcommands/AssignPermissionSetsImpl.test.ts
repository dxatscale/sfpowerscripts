import child_process = require("child_process");
import AssignPermissionSetsImpl from "../../src/sfpcommands/permsets/AssignPermissionSetsImpl";
import { jest,expect } from "@jest/globals";
import { VoidLogger } from "../../src/logger/SFPLogger";

jest.mock("../../src/sfdxwrappers/AliasListImpl", () => {
  class AliasListImpl {
    exec() {
      return aliasList;
    }
  }
  return AliasListImpl;
});

jest.mock("../../src/sfdxwrappers/PermsetListImpl", () => {
  class PermsetListImpl {
    constructor(private username: string, private target_org: string) {}
    exec(): any[] {
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
  return PermsetListImpl;
});

describe("Given a set of permsets, assign it to the user who is deploying the packages", () => {
  it("should assign a set of  permset, if its not previously assigned", () => {
    let alias = "S05";
    let assignPermSetImpl: AssignPermissionSetsImpl = new AssignPermissionSetsImpl(
      alias,
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

    let results = assignPermSetImpl.exec();
    expect(results.successfullAssignments).toHaveLength(2);
    expect(results.failedAssignments).toHaveLength(0);

  });


  it("should assign a partial set  of  permset, if any of them fails", () => {
    let alias = "S05";
    let assignPermSetImpl: AssignPermissionSetsImpl = new AssignPermissionSetsImpl(
      alias,
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

    let results = assignPermSetImpl.exec();
    expect(results.successfullAssignments).toHaveLength(1);
    expect(results.failedAssignments).toHaveLength(1);
  });


  it("should assign none, if all of them fails", () => {
    let alias = "S05";
    let assignPermSetImpl: AssignPermissionSetsImpl = new AssignPermissionSetsImpl(
      alias,
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

    let results = assignPermSetImpl.exec();
    expect(results.successfullAssignments).toHaveLength(0);
    expect(results.failedAssignments).toHaveLength(2);
  });
});


const aliasList = [
  {
    "alias": "s01",
    "value": "test-jx6iygd1o2pw@example.com"
  },
  {
    "alias": "S03",
    "value": "test-db2xyqz7wdw3@example.com"
  },
  {
    "alias": "nufsupport",
    "value": "azlam.abdulsalam@accenture.com.support"
  },
  {
    "alias": "S05",
    "value": "test-sfvulqawd2w0@example.com"
  }
];
