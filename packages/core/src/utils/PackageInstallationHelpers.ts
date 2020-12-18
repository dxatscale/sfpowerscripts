import { sfdx } from "../../../sfpowerscripts-cli/lib/impl/pool/sfdxnode/parallel";
import child_process = require("child_process");

export default class PackageInstallationHelpers {

  static executeScript(script: string, sfdx_package: string, targetOrg: string) {
    let cmd: string;
    if (process.platform !== 'win32') {
      cmd = `bash -e ${script} ${sfdx_package} ${targetOrg}`;
    } else {
      cmd = `cmd.exe /c ${script} ${sfdx_package} ${targetOrg}`;
    }

    child_process.execSync(
      cmd,
      {
        cwd: process.cwd(),
        stdio: ['ignore', 'inherit', 'inherit']
      }
    );
  }
}
