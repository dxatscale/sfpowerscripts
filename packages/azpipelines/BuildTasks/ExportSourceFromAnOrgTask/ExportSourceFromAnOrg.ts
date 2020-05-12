import tl = require("azure-pipelines-task-lib/task");
import  ExportSourceFromAnOrgImpl  from "@dxatscale/sfpowerscripts.core/lib/sfdxwrappers/ExportSourceFromAnOrgImpl";
import { AppInsights } from "../Common/AppInsights";


async function run() {
  try {
    console.log("SFPowerScript.. Export Source from an  Org");

    AppInsights.setupAppInsights(tl.getBoolInput("isTelemetryEnabled", true));

    const target_org: string = tl.getInput("target_org", true);
    const source_directory: string = tl.getInput("source_directory", true);
    const filter: string = tl.getInput("quickFilter", false);
    const isManagedPackagesToBeExcluded = tl.getBoolInput(
      "isManagedPackageComponentsToBeExcluded",
      false
    );
    const isUnzipEnabled = tl.getBoolInput("isUnzipEnabled", false);

   
   let  exportSourceFromAnOrgImpl = new ExportSourceFromAnOrgImpl(
      target_org,
      source_directory,
      filter,
      isManagedPackagesToBeExcluded,
      isUnzipEnabled
    );

    let zipPath = await exportSourceFromAnOrgImpl.exec();

    if(!isUnzipEnabled)
    tl.setVariable("sfpowerscripts_exportedsource_zip_path",zipPath);

    AppInsights.trackTask("sfpowerscript-exportsourcefromorg-task");
    AppInsights.trackTaskEvent(
      "sfpowerscript-exportsourcefromorg-task",
      "source_exported"
    );
  } catch (err) {
    AppInsights.trackExcepiton("sfpowerscript-exportsourcefromorg-task", err);
    tl.setResult(tl.TaskResult.Failed, err.message);
  }
}

run();
