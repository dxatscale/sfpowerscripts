import tl = require("azure-pipelines-task-lib/task");
import DeleteScratchOrgImpl from "@dxatscale/sfpowerscripts.core/lib/sfdxwrappers/DeleteScratchOrgImpl";



async function run() {
  try {
    const action: string = tl.getInput("action", true);
    const maintainorg: string = tl.getInput("maintainorg", true);
    const devhub_alias: string = tl.getInput("devhub_alias", true);
    const target_org: string = tl.getInput("target_org", true);

    if (action == "Create" && maintainorg == "delete") {
      console.log("SFPowerScript.. Delete the created scratch org");

      let deleteScratchOrgImpl: DeleteScratchOrgImpl = new DeleteScratchOrgImpl(
        target_org,
        devhub_alias
      );
      console.log("Generating Delete Scratch Org command");
      let command = await deleteScratchOrgImpl.buildExecCommand();
      tl.debug(command);
      await deleteScratchOrgImpl.exec(command);

    
    }
    else
    {
      tl.setResult(
        tl.TaskResult.Skipped,
        `Skipping Post Job as the Action for this task is ${action} or the option set for this org is to  ${maintainorg}`
      );
    }
  } catch (err) {

    tl.setResult(tl.TaskResult.Failed, err.message);
  }
}

run();


