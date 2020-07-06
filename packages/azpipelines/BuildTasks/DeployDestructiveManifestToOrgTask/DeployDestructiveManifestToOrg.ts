import tl = require("azure-pipelines-task-lib/task");
import DeployDestructiveManifestToOrgImpl from "@dxatscale/sfpowerscripts.core/lib/sfdxwrappers/DeployDestructiveManifestToOrgImpl";
import fs = require("fs");
import path = require("path");


async function run() {
  try {
    console.log("SFPowerScript.. Deploy Destructive Manifest to Org");

    const targetOrg: string = tl.getInput("target_org", true);
    const type: string = tl.getInput("type", true);
    const skipOnMissingManifest: boolean = tl.getBoolInput("skip_on_missing_manifest", false);


    let destructiveManifestPath = null;

    if(type == "text")
    {
      let destructiveManifest=  tl.getInput("destructive_manifest_text",true);
      destructiveManifestPath = path.join(__dirname,"destructiveChanges.xml")
      fs.writeFileSync(destructiveManifestPath,destructiveManifest);
    }
    else
    {
      destructiveManifestPath =  tl.getInput("destructive_manifest_filepath", true);
      console.log(`Destructive Manifest File Path: ${destructiveManifestPath}`);
      if(!fs.existsSync(destructiveManifestPath))
      {
        if (skipOnMissingManifest) {
          tl.setResult(tl.TaskResult.Skipped, "Unable to find the specified manifest file");
          return;
        } else {
          tl.setResult(tl.TaskResult.Failed,"Unable to find the specified manifest file");
          return;
        }
      }
    }

    console.log("Displaying Destructive Manifest");

    let destructiveManifest:Buffer = fs.readFileSync(destructiveManifestPath);
    console.log(destructiveManifest.toString());

    let  deploySourceToOrgImpl:DeployDestructiveManifestToOrgImpl = new DeployDestructiveManifestToOrgImpl(targetOrg,destructiveManifestPath);

    let command:string = await deploySourceToOrgImpl.buildExecCommand();
    await deploySourceToOrgImpl.exec(command);


    console.log("Destuctive Changes succesfully deployed");


    console.log(`##vso[task.logdetail id=dc45919a-dc91-46cb-94ca-86d105a444e0;name=Destructive Manifest Deployed;type=build;order=6;state=Completed;result=Succeeded]${destructiveManifest.toString()}`);
    tl.setResult(tl.TaskResult.Succeeded,"Destuctive Changes succesfully deployed",true);

  } catch (err) {
    tl.setResult(tl.TaskResult.Failed, err.message);
  }
}

run();
