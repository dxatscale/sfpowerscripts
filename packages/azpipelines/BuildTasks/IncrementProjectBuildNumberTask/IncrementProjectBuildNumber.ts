import tl = require("azure-pipelines-task-lib/task");
import IncrementProjectBuildNumberImpl from "@dxatscale/sfpowerscripts.core/lib/sfdxwrappers/IncrementProjectBuildNumberImpl";
import child_process = require("child_process");
import { isNullOrUndefined } from "util";
import { AppInsights } from "../Common/AppInsights";

async function run() {
  try {
    const segment: string = tl.getInput("segment", true);
    const sfdx_package: string = tl.getInput("package", false);
    let project_directory: string = tl.getInput("project_directory", false);
    const set_build_number: boolean = tl.getBoolInput("set_build_number",true);
    const appendBuildNumber: boolean = tl.getBoolInput("appendBuildNumber",false);

    const commit_changes: boolean = tl.getBoolInput("commit_changes",false);

    AppInsights.setupAppInsights(tl.getBoolInput("isTelemetryEnabled",true));
   
     const runNumber = tl.getVariable('build.buildNumber');

    let incrementProjectBuildNumberImpl: IncrementProjectBuildNumberImpl = new IncrementProjectBuildNumberImpl(
      project_directory,
      sfdx_package,
      segment,
      appendBuildNumber,
      runNumber
    );

    let result:{status:boolean,ignore:boolean,versionNumber:string} = await incrementProjectBuildNumberImpl.exec();

    if (set_build_number) {
      console.log(`Updating build number to ${result.versionNumber}`);
      tl.updateBuildNumber(result.versionNumber);
    }

    tl.setVariable("sfpowerscripts_incremented_project_version", result.versionNumber,false);
   
    let repo_localpath = tl.getVariable("build.repository.localpath");
  

    if(!appendBuildNumber && commit_changes && !result.ignore)
    {

      child_process.execSync(" git config user.email sfpowerscripts@dxscale");
      child_process.execSync(" git config user.name sfpowerscripts");
      
    
      console.log("Committing to Git");
      let exec_result = child_process.execSync("git add sfdx-project.json", {
        cwd: repo_localpath}
      );
     
      console.log(exec_result.toString());
  
      exec_result = child_process.execSync(
        `git commit  -m "[skip ci] Updated Version "`,
        { cwd: repo_localpath }
      );
      console.log(exec_result.toString());
    }
    
    

  AppInsights.trackTask("sfpwowerscript-incrementversionnumber-task");
  AppInsights.trackTaskEvent("sfpwowerscript-incrementversionnumber-task","project_version_incremented");    
    
  } catch (err) {
    AppInsights.trackExcepiton("sfpwowerscript-incrementversionnumber-task",err);    
    tl.setResult(tl.TaskResult.Failed, err.message);
  }
}

run();
