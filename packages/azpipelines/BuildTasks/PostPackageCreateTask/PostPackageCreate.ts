import tl = require("azure-pipelines-task-lib/task");
import { exec } from "shelljs";
import { readdirSync, statSync } from "fs-extra";
import { join } from "path";
import authGit from "../Common/VersionControlAuth";
import simplegit from "simple-git/promise";

async function run() {
  console.log("Pushing Tags if any... ");
  tl.setVariable("post_package_task_executed","true");

  let tagsToPush:tl.VariableInfo[]= tl.getVariables().filter( variable => variable.name.includes("_sfpowerscripts_git_tag"));

  tagsToPush.forEach(element => {
   //slice variable to figure package name
   let sfdx_package:string = element.name.split('_')[0];
   createandPushGitTag(tl.getVariable(element.name),tl.getVariable(`${sfdx_package}_sfpowerscripts_git_tag_directory_path`));
  });



}

async function createandPushGitTag(tagname: string,project_directory:string): Promise<void> {

 
  let tasktype = tl.getVariable("Release.ReleaseId") ? "Release" : "Build";
  
    let git;
    if(tasktype == 'Build')
     git = simplegit(tl.getVariable("Build.Repository.LocalPath"));
    else
      git = simplegit(project_directory);
  
    let remote = await authGit();
  
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
  
    await git
      .silent(false)
      .push(
        remote,
        tagname
      );

  console.log(`Pushed tag ${tagname} to repo`);
    
  }
  

run();
