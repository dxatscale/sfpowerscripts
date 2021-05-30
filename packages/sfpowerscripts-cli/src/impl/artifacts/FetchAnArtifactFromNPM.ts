import * as fs from "fs-extra";
import child_process = require("child_process");
import path = require("path");
import FetchAnArtifact from "./FetchAnArtifact";

export class FetchAnArtifactFromNPM implements FetchAnArtifact {
  
  constructor(
    private scope: string,
    private npmTag: string,
    private npmrcPath: string
  ) {
    if (this.npmrcPath) {
      fs.copyFileSync(this.npmrcPath, path.resolve(".npmrc"));

      if (!fs.existsSync("package.json")) {
        // package json is required in the same directory as .npmrc
        fs.writeFileSync("package.json", "{}");
      }
    }
  }


  public fetchArtifact(
    packageName: string,
    artifactDirectory: string
  ) {
    // NPM package names must be lowercase
    packageName = packageName.toLowerCase();

    let cmd: string;
    if (this.scope)
      cmd = `npm pack @${this.scope}/${packageName}_sfpowerscripts_artifact`;
    else cmd = `npm pack ${packageName}_sfpowerscripts_artifact`;

    if (this.npmTag) cmd += `@${this.npmTag}`;

    child_process.execSync(cmd, {
      cwd: artifactDirectory,
      stdio: ["ignore", "inherit", "inherit"],
    });
  }
}
