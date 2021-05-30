import { jest, expect } from "@jest/globals";
import ConvertSourceToMDAPIImpl from "../../src/sfdxwrappers/ConvertSourceToMDAPIImpl";
import path from "path";

let commmandOutput: string = "";
jest.mock("../../src/command/commandExecutor/ExecuteCommand", () => {
  class ExecuteCommand {
    constructor() {}
    execCommand = function (
      command: string,
      workingdirectory: string
    ): Promise<any> {
      return new Promise((resolve, reject) => {
        if (commmandOutput != null) resolve(commmandOutput);
        else reject("Failed to execute");
      });
    };
  }
  return ExecuteCommand;
});

describe("Given a source directory, it should be able to convert to mdapi directory", () => {
  it("should provide the path to a mdapi directory", async () => {
    jest.spyOn(path, "resolve").mockReturnValueOnce("mdapidir");
    commmandOutput =
      "Source was successfully converted to Metadata API format and written to the location: C:Projectseasy-spaces-sfpowermdapi2";
    let convertSourceToMDAPImpl: ConvertSourceToMDAPIImpl = new ConvertSourceToMDAPIImpl(
      null,
      "es-space-mgmt"
    );
    let command = convertSourceToMDAPImpl.getGeneratedSFDXCommandWithParams();
    expect(command).toEqual(
      expect.stringContaining("sfdx force:source:convert -r es-space-mgmt  -d")
    );
    let result = await convertSourceToMDAPImpl.exec();
    expect(result).toStrictEqual("mdapidir");
  });

  it("should throw an exception, if unable to convert", async () => {
    jest.spyOn(path, "resolve").mockReturnValueOnce("mdapidir");
    commmandOutput = null;
    let convertSourceToMDAPImpl: ConvertSourceToMDAPIImpl = new ConvertSourceToMDAPIImpl(
      null,
      "es-space-mgmt"
    );
    let command = convertSourceToMDAPImpl.getGeneratedSFDXCommandWithParams();
    expect(command).toEqual(
      expect.stringContaining("sfdx force:source:convert -r es-space-mgmt  -d")
    );
    try {
      await convertSourceToMDAPImpl.exec();
    } catch (error) {
      expect(error).toBeDefined();
    }
  });
});
