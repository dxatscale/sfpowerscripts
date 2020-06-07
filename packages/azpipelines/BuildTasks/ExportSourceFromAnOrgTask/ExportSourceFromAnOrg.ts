import tl = require("azure-pipelines-task-lib/task");
import  ExportSourceFromAnOrgImpl  from "@dxatscale/sfpowerscripts.core/lib/sfdxwrappers/ExportSourceFromAnOrgImpl";


async function run() {
  try {
    console.log("SFPowerScript.. Export Source from an  Org");


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


  } catch (err) {
    tl.setResult(tl.TaskResult.Failed, err.message);
  }
}

run();
