import tl = require("azure-pipelines-task-lib/task");
import PackageDiffImpl from "@dxatscale/sfpowerscripts.core/lib/sfdxwrappers/PackageDiffImpl";
import authGit from "../Common/VersionControlAuth";
const fs = require("fs");
import simplegit from "simple-git/promise";

async function run() {
  try {
    let sfdx_package: string = tl.getInput("package", true);
    let version_number: string = tl.getInput("version_number", true);
    let isDiffCheck: boolean = tl.getBoolInput("isDiffCheck", false);
    let isGitTag: boolean = tl.getBoolInput("isGitTag", false);
    let project_directory: string = tl.getInput("project_directory", false);
    let commit_id = tl.getVariable("build.sourceVersion");
    let repository_url = tl.getVariable("build.repository.uri");


    let isRunBuild: boolean;
    if (isDiffCheck) {
      console.log("Heading to package Diff Impl");
  
      let packageDiffImpl = new PackageDiffImpl(sfdx_package, project_directory);
      

      isRunBuild = await packageDiffImpl.exec();

      if (isRunBuild)
        console.log(`Detected changes to ${sfdx_package} package...proceeding`);
      else
        console.log(`No changes detected for ${sfdx_package} package...skipping`);

    } else isRunBuild = true;


    if (isRunBuild) {

      let metadata = {
        package_name: sfdx_package,
        package_version_number: version_number,
        sourceVersion: commit_id,
        repository_url: repository_url,
        package_type: "source",
      };

      let artifactFileName: string = `/${sfdx_package}_artifact_metadata`;

      fs.writeFileSync(__dirname + artifactFileName, JSON.stringify(metadata));

      let data = {
        artifacttype: "container",
        artifactname: "sfpowerkit_artifact",
      };
      // upload or copy
      data["containerfolder"] = "sfpowerkit_artifact";

      // add localpath to ##vso command's properties for back compat of old Xplat agent
      data["localpath"] = __dirname + artifactFileName;
      tl.command("artifact.upload", data, __dirname + artifactFileName);

      tl.setVariable("sfpowerscripts_package_version_number", version_number);

      if (isGitTag) {
        let tagname: string = `${sfdx_package}_v${version_number}`;
        await createGitTag(tagname,project_directory);
      }


    }
  } catch (err) {
    tl.setResult(tl.TaskResult.Failed, err.message);
  }
}

async function createGitTag(tagname: string,project_directory:string): Promise<void> {


  let tasktype = tl.getVariable("Release.ReleaseId") ? "Release" : "Build";

  let git;
  if(tasktype == 'Build')
   git = simplegit(tl.getVariable("Build.Repository.LocalPath"));
  else
    git = simplegit(project_directory);


  let remote = await authGit();

  tl.setVariable("git_remote_url",remote);

  await git
  .addConfig("user.name", "sfpowerscripts");

  await git
  .addConfig("user.email", "sfpowerscripts@dxscale");

  await git
        .silent(false)
        .addAnnotatedTag(
          tagname,
          'Unlocked Package'
        );

  console.log(`Created tag ${tagname}`);
}

run();
