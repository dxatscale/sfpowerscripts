import SFPLogger, { COLOR_WARNING } from "@dxatscale/sfpowerscripts.core/lib/logger/SFPLogger";
import { fs } from "@salesforce/core";
import child_process = require("child_process");
import FetchAnArtifact from "./FetchAnArtifact";

export class FetchAnArtifactUsingScript implements FetchAnArtifact {
  constructor(private scriptPath: string) {}

  public fetchArtifact(
    packageName: string,
    artifactDirectory: string,
    version: string,
    isToContinueOnMissingArtifact: boolean
  ) {
    try {
      let cmd: string;

      //Create artifact Directory if it doesnt exist
      if(!fs.existsSync(artifactDirectory))
           fs.mkdirpSync(artifactDirectory)

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
    } catch (error) {
      if(!isToContinueOnMissingArtifact)
      throw error;
    else
     SFPLogger.log( COLOR_WARNING(`Artifact  for ${packageName} missing in NPM Registry provided, This might result in deployment failures`))
    }
  }
}
