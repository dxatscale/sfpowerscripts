import PermsetListImpl from "../../src/sfdxwrappers/PermsetListImpl";
import { jest,expect } from "@jest/globals";

import child_process = require("child_process");

describe("Retrieve assigned permsets provided username and a target org", () => {
  it("should return all the permsets for the provided username", () => {
    let alias = "S05";
    let username = "testuser@test.com";
    
    const child_processMock = jest.spyOn(child_process, "execSync");
    child_processMock.mockImplementation(() => {
      return Buffer.from(`{
        "status": 0,
        "result": {
          "totalSize": 2,
          "done": true,
          "records": [
            {
              "attributes": {
                "type": "PermissionSetAssignment",
                "url": "/services/data/v50.0/sobjects/PermissionSetAssignment/0Pa2s000000PC8fCAG"
              },
              "Id": "0Pa2s000000PC8fCAG",
              "PermissionSet": {
                "attributes": {
                  "type": "PermissionSet",
                  "url": "/services/data/v50.0/sobjects/PermissionSet/0PS2s000000bldoGAA"
                },
                "Name": "Salesforce_DX_Permissions"
              },
              "Assignee": {
                "attributes": {
                  "type": "User",
                  "url": "/services/data/v50.0/sobjects/User/0052s000000kuInAAI"
                },
                "Username": "atestuser@test.com"
              }
            },
            {
              "attributes": {
                "type": "PermissionSetAssignment",
                "url": "/services/data/v50.0/sobjects/PermissionSetAssignment/0Pa2s000000PC8aCAG"
              },
              "Id": "0Pa2s000000PC8aCAG",
              "PermissionSet": {
                "attributes": {
                  "type": "PermissionSet",
                  "url": "/services/data/v50.0/sobjects/PermissionSet/0PS6F000004MA6gWAG"
                },
                "Name": "X00ex00000018ozT_128_09_43_34_1"
              },
              "Assignee": {
                "attributes": {
                  "type": "User",
                  "url": "/services/data/v50.0/sobjects/User/0052s000000kuInAAI"
                },
                "Username": "testuser@test.com"
              }
            }
          ]
        }
      }`);
    });
    let permsetListImpl: PermsetListImpl = new PermsetListImpl(username, alias);
    let permsetRecords = permsetListImpl.exec();
    expect(permsetRecords).toHaveLength(2);
  });

  it("should return an empty array, if no permsets are assigned", () => {
    let alias = "S05";
    let username = "testuser@test.com";
    
    const child_processMock = jest.spyOn(child_process, "execSync");
    child_processMock.mockImplementation(() => {
      return Buffer.from(`{
       "status": 0,
       "result": {
         "totalSize": 0,
         "done": true,
         "records": [
         ]
       }
     }`);
    });
    let permsetListImpl: PermsetListImpl = new PermsetListImpl(username, alias);
    let permsetRecords = permsetListImpl.exec();
    expect(permsetRecords).toHaveLength(0);
  });

  it("should throw an error, if unable to query permsets", () => {
    let alias = "S05";
    let username = "testuser@test.com";
 
    const child_processMock = jest.spyOn(child_process, "execSync");
    child_processMock.mockImplementation(() => {
      return Buffer.from(`{
       "status": 1,
       "result": {
         "totalSize": 0,
         "done": false,
         "records": [
         ]
       }
     }`);
    });
    let permsetListImpl: PermsetListImpl = new PermsetListImpl(username, alias);
    expect(() => permsetListImpl.exec()).toThrowError();
  });
});
