import tl = require("azure-pipelines-task-lib/task");
import child_process = require("child_process");
import { onExit } from "@dxatscale/sfpowerscripts.core/lib/utils/OnExit";
import { getWebAPIWithoutToken } from "../Common/WebAPIHelper";
import { IReleaseApi } from "azure-devops-node-api/ReleaseApi";
import { Release, Artifact } from "azure-devops-node-api/interfaces/ReleaseInterfaces";


async function run() {
  try {
    console.log("sfpowerscripts... Generate Changelog.......");

    const devhub_alias: string = tl.getInput("devhub_alias", true);
    const target_org: string = tl.getInput("target_org", true);
    const keys:string=tl.getInput("keys",false);
    const apexcompileonlypackage:boolean=tl.getBoolInput("apexcompileonlypackage",false);
    const forceinstall:boolean=tl.getBoolInput("forceinstall",false);
    const working_directory: string = tl.getInput("working_directory", false);
    const wait_time: string = tl.getInput("wait_time", true);

    //WebAPI Initialization
    const webApi = await getWebAPIWithoutToken();
    const releaseApi: IReleaseApi = await webApi.getReleaseApi();

    let project: string = tl.getVariable('System.TeamProject');
    let releaseId: number = parseInt(tl.getVariable('Release.ReleaseId'), 10);
    console.log(project);
    console.log(releaseId);
    let release: Release = await releaseApi.getRelease(project, releaseId);
    console.log(release.artifacts);


    // let child=child_process.exec(command,  { cwd: working_directory,encoding: "utf8" },(error,stdout,stderr)=>{

    //   if(error)
    //      throw error;
    // });

    // child.stdout.on("data",data=>{console.log(data.toString()); });

    // await onExit(child);
    tl.setResult(tl.TaskResult.Succeeded, 'Finished');

  } catch (err) {
    tl.setResult(tl.TaskResult.Failed, err.message);
  }
}



run();
