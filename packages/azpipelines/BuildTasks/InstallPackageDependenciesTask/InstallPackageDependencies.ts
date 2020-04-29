import tl = require("azure-pipelines-task-lib/task");
import child_process = require("child_process");
import { onExit } from "@dxatscale/sfpowerscripts.core/lib/OnExit";
import { AppInsights } from "../Common/AppInsights";


async function run() {
  try {
    console.log("SFPowerScript.. Install Package Dependencies");

    const devhub_alias: string = tl.getInput("devhub_alias", true);
    const target_org: string = tl.getInput("target_org", true);
    const keys:string=tl.getInput("keys",false);
    const apexcompileonlypackage:boolean=tl.getBoolInput("apexcompileonlypackage",false);
    const forceinstall:boolean=tl.getBoolInput("forceinstall",false);
    const working_directory: string = tl.getInput("working_directory", false);

    AppInsights.setupAppInsights(tl.getBoolInput("isTelemetryEnabled",true));

    let command= `npx sfdx sfpowerkit:package:dependencies:install -u ${target_org} -v ${devhub_alias} -r`
    if(apexcompileonlypackage)
    command+=` -a`
    if(keys!=null && keys.length>0)
    command+=` ${keys}`

    if(forceinstall)
    command+=` -o`
    
    tl.debug(command);


  
    let child=child_process.exec(command,  { cwd: working_directory,encoding: "utf8" },(error,stdout,stderr)=>{

      if(error)
         throw error;
    });
   
    child.stdout.on("data",data=>{console.log(data.toString()); });

    await onExit(child);
  

    

    AppInsights.trackTask("sfpowerscript-installpackagedependencies-task");
    AppInsights.trackTaskEvent("sfpowerscript-installpackagedependencies-task","dependencies_installed");    

  } catch (err) {
    AppInsights.trackExcepiton("sfpowerscript-installpackagedependencies-task",err);    
    tl.setResult(tl.TaskResult.Failed, err.message);
  }
}



run();
