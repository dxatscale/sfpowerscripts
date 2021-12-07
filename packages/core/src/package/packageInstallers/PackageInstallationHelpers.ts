import { Connection } from "@salesforce/core";
import ExecuteCommand from "../../command/commandExecutor/ExecuteCommand";
import SFPLogger, { Logger, LoggerLevel } from "../../logger/SFPLogger";
import AssignPermissionSets from "../../permsets/AssignPermissionSets";

export default class PackageInstallationHelpers {
  static  async executeScript(
    script: string,
    sfdx_package: string,
    targetOrg: string,
    logger:Logger
  ) {
    let cmd: string;
    if (process.platform !== "win32") {
      cmd = `sh -e ${script} ${sfdx_package} ${targetOrg}`;
    } else {
      cmd = `cmd.exe /c ${script} ${sfdx_package} ${targetOrg}`;
    }

    SFPLogger.log(`Executing command.. ${cmd}`)
    let scriptExecutor:ExecuteCommand = new ExecuteCommand(logger,LoggerLevel.INFO,true);
    let result= await scriptExecutor.execCommand(cmd,null)
    SFPLogger.log(result,LoggerLevel.INFO,logger);

  }

  static async applyPermsets(
    permsets: string[],
    conn:Connection,
    sourceDirectory: string,
    logger:Logger
  ) {
    let assignPermissionSetsImpl: AssignPermissionSets = new AssignPermissionSets(
      conn,
      permsets,
      sourceDirectory,
      logger
    );

    let results = await assignPermissionSetsImpl.exec();
    if (results.failedAssignments.length > 0)
      throw new Error("Unable to assign permsets");
  }
}
