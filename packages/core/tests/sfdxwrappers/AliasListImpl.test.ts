import AliasListImpl from "../../src/sfdxwrappers/AliasListImpl";
import { jest,expect } from "@jest/globals";

import child_process = require("child_process");

describe("Given all authenticated orgs and provided an alias, return the username",()=>{


   it("should return the username,if the alias is provided",()=>{
     let alias="S05";
     let aliasImpl:AliasListImpl=new AliasListImpl(alias);
     const child_processMock = jest.spyOn(child_process, "execSync");
     child_processMock.mockImplementation(() => {
      return Buffer.from(`{
        "status": 0,
        "result": [
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
        ]
      }`);});

      let userName=aliasImpl.exec();
      expect(userName).toBe("test-sfvulqawd2w0@example.com");
   });

   it("should return the username,if the username is provided",()=>{
    let alias="test-sfvulqawd2w0@example.com";
    let aliasImpl:AliasListImpl=new AliasListImpl(alias);
    const child_processMock = jest.spyOn(child_process, "execSync");
    child_processMock.mockImplementation(() => {
     return Buffer.from(`{
       "status": 0,
       "result": [
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
       ]
     }`);});

     let userName=aliasImpl.exec();
     expect(userName).toBe("test-sfvulqawd2w0@example.com");
  });


  it("should throw an error, if unable to fetch a matching username ",()=>{
    let alias="test-sfvulqawd3w0@example.com";
    let aliasImpl:AliasListImpl=new AliasListImpl(alias);
    const child_processMock = jest.spyOn(child_process, "execSync");
    child_processMock.mockImplementation(() => {
     return Buffer.from(`{
       "status": 0,
       "result": [
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
       ]
     }`);});


     expect(()=>aliasImpl.exec()).toThrowError();
  });



});