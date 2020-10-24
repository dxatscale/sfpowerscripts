import tl = require("azure-pipelines-task-lib/task");
import authVCS from "../Common/VersionControlAuth";
import simplegit from "simple-git/promise";

async function run() {
  console.log("Pushing Tags if any... ");
  tl.setVariable("post_package_task_executed", "true");

  let tagsToPush: tl.VariableInfo[] = tl
    .getVariables()
    .filter((variable) => variable.name.includes("_sfpowerscripts_git_tag"));

  console.log("Found Tags To Push", JSON.stringify(tagsToPush));

  for (const element of tagsToPush) {
    try
    {
    let sfdx_package: string = element.name.substring(0,element.name.indexOf("_sfpowerscripts_git_tag"));
    console.log("Package", sfdx_package);
    await createandPushGitTag(
      tl.getVariable(element.name),
      tl.getVariable(`${sfdx_package}_sfpowerscripts_project_directory_path`)
    );
    }
    catch(error) {
      tl.setResult(tl.TaskResult.Failed,"Failed to push tags"+error,true);
    }
  }
}

async function createandPushGitTag(
  tagname: string,
  project_directory: string
): Promise<void> {
  let tasktype = tl.getVariable("Release.ReleaseId") ? "Release" : "Build";

  let git;
  if (tasktype == "Build")
    git = simplegit(tl.getVariable("Build.Repository.LocalPath"));
  else git = simplegit(project_directory);

  let repository_url:string = tl.getVariable("Build.Repository.Uri");
  let remote = authVCS(repository_url);

  await git.addConfig("user.name", "sfpowerscripts");

  await git.addConfig("user.email", "sfpowerscripts@dxscale");

  await git.silent(false).addAnnotatedTag(tagname, "sfpowerscripts Package");

  console.log(`Created tag ${tagname}`);

  await git.silent(false).push(remote, tagname);

  console.log(`Pushed tag ${tagname} to repo`);
}

run();
