import child_process = require("child_process");
import SFPLogger, { Logger, LoggerLevel } from "../../logger/SFPLogger";
import AssignPermissionSetsImpl from "../permsets/AssignPermissionSetsImpl";

export default class PackageInstallationHelpers {
  static executeScript(
    script: string,
    sfdx_package: string,
    targetOrg: string,
    logger:Logger
  ) {
    let cmd: string;
    if (process.platform !== "win32") {
      cmd = `bash -e ${script} ${sfdx_package} ${targetOrg}`;
    } else {
      cmd = `cmd.exe /c ${script} ${sfdx_package} ${targetOrg}`;
    }

    let result = child_process.execSync(cmd, {
      cwd: process.cwd(),
      stdio: ["ignore", "ignore", "ignore"],
    });

    SFPLogger.log(result.toString(),LoggerLevel.INFO,logger);

  }

  static applyPermsets(
    permsets: string[],
    targetusername: string,
    sourceDirectory: string,
    logger:Logger
  ) {
    let assignPermissionSetsImpl: AssignPermissionSetsImpl = new AssignPermissionSetsImpl(
      targetusername,
      permsets,
      sourceDirectory,
      logger
    );

    let results = assignPermissionSetsImpl.exec();
    if (results.failedAssignments.length > 0)
      throw new Error("Unable to assign permsets");
  }
}
