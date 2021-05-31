import child_process = require("child_process");
import FetchAnArtifact from "./FetchAnArtifact";

export class FetchAnArtifactUsingScript implements FetchAnArtifact {
  constructor(private scriptPath: string) {}

  public fetchArtifact(
    packageName: string,
    artifactDirectory: string,
    version: string
  ) {
    let cmd: string;

    if (version) {
      if (process.platform !== "win32") {
        cmd = `bash -e "${this.scriptPath}" "${packageName}" "${version}" "${artifactDirectory}"`;
      } else {
        cmd = `cmd.exe /c "${this.scriptPath}" "${packageName}" "${version}" "${artifactDirectory}"`;
      }
    } else {
      if (process.platform !== "win32") {
        cmd = `bash -e ${this.scriptPath} ${packageName} ${artifactDirectory}`;
      } else {
        cmd = `cmd.exe /c ${this.scriptPath} ${packageName}  ${artifactDirectory}`;
      }
    }

    console.log(`Fetching ${packageName} using ${cmd}`);

    child_process.execSync(cmd, {
      cwd: process.cwd(),
      stdio: "pipe",
    });
  }
}
