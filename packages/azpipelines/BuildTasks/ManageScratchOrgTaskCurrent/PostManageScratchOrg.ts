import tl = require("azure-pipelines-task-lib/task");
import DeleteScratchOrgImpl from "@dxatscale/sfpowerscripts.core/lib/sfdxwrappers/DeleteScratchOrgImpl";

import { AppInsights } from "../Common/AppInsights";


async function run() {
  try {
    const maintainorg: string = tl.getInput("maintainorg", true);
    const devhub_alias: string = tl.getInput("devhub_alias", true);
    const target_org: string = tl.getInput("target_org", true);

    if (maintainorg == "delete") {
      console.log("SFPowerScript.. Delete the created scratch org");

      let deleteScratchOrgImpl: DeleteScratchOrgImpl = new DeleteScratchOrgImpl(
        target_org,
        devhub_alias
      );
      console.log("Generating Delete Scratch Org command");
      let command = await deleteScratchOrgImpl.buildExecCommand();
      tl.debug(command);
      await deleteScratchOrgImpl.exec(command);

      AppInsights.trackTaskEvent(
        "sfpwowerscript-managescratchorg-task",
        "scratchorg_deleted"
      );

      AppInsights.trackTask("sfpwowerscript-managescratchorg-task");
    }
  } catch (err) {
    AppInsights.trackExcepiton("sfpwowerscript-managescratchorg-task", err);
    tl.setResult(tl.TaskResult.Failed, err.message);
  }
}

run();


