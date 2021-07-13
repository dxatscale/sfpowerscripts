import * as fs from "fs-extra";
import child_process = require("child_process");
import path = require("path");
import FetchAnArtifact from "./FetchAnArtifact";

export class FetchAnArtifactFromNPM implements FetchAnArtifact {
  
  constructor(
    private scope: string,
    private npmrcPath: string
  ) {
    if (this.npmrcPath) {

      try
      {
      fs.copyFileSync(this.npmrcPath, path.resolve(".npmrc"));
      }catch(error)
      {
        throw new error("We were unable to find or copy the .npmrc file as provided due to "+error.message);
      }
      if (!fs.existsSync("package.json")) {
        // package json is required in the same directory as .npmrc
        fs.writeFileSync("package.json", "{}");
      }
    }
  }


  public fetchArtifact(
    packageName: string,
    artifactDirectory: string,
    version?:string
  ) {
    // NPM package names must be lowercase
    packageName = packageName.toLowerCase();

    let cmd: string;
    if (this.scope)
      cmd = `npm pack @${this.scope}/${packageName}_sfpowerscripts_artifact`;
    else cmd = `npm pack ${packageName}_sfpowerscripts_artifact`;

    if(version)
       cmd += `@${version}`
  

    console.log(`Fetching ${packageName} using ${cmd}`);

    child_process.execSync(cmd, {
      cwd: artifactDirectory,
      stdio: "pipe",
    });
  }
}
