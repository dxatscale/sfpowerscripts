import child_process = require("child_process");
import  FetchAnArtifact  from "./FetchAnArtifact";

export class FetchAnArtifactUsingScript implements FetchAnArtifact {
  constructor(private scriptPath: string) {}

  public fetchArtifact(
    packageName: string,
    artifactDirectory: string
  ) {
    let cmd: string;
    if (process.platform !== "win32") {
      cmd = `bash -e ${this.scriptPath} ${packageName} ${artifactDirectory}`;
    } else {
      cmd = `cmd.exe /c ${this.scriptPath} ${packageName}  ${artifactDirectory}`;
    }

    child_process.execSync(cmd, {
      cwd: process.cwd(),
      stdio: ["ignore", "inherit", "inherit"],
    });
  }
}
