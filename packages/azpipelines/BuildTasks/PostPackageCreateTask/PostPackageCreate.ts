import tl = require("azure-pipelines-task-lib/task");
import { exec } from "shelljs";
import { readdirSync, statSync } from "fs-extra";
import { join } from "path";

async function run() {
  console.log("Pushing Tags if any... ");
  console.log("Remote", tl.getVariable("git_remote_url"));
  await pushGitTag();
}

async function pushGitTag(): Promise<void> {
  let tasktype = tl.getVariable("Release.ReleaseId") ? "Release" : "Build";

  console.log("Task Type", tasktype);

  if (tasktype == "Build") {
    tl.cd(tl.getVariable("Build.Repository.LocalPath"));
    exec(`git push origin  --tags`, { silent: false });
  } else {
    tl.cd(tl.getVariable("system.artifactsDirectory"));
    console.log(process.cwd());
    const findDirs = (p) =>
      readdirSync(p).filter((f) => statSync(join(p, f)).isDirectory());
    let dirs: string[] = findDirs(process.cwd());

    dirs.forEach((element) => {
      tl.cd(element);
      console.log("Scanning Directory for tag", process.cwd());
      exec(`git push origin  --tags`, { silent: false });
      tl.cd(tl.getVariable("system.artifactsDirectory"));
    });
  }
  console.log(`Completed Post Processing for Create Package Task`);
}

run();
