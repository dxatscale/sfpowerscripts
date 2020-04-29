import tl = require("azure-pipelines-task-lib/task");
import ValidateDXUnlockedPackageImpl from "@dxatscale/sfpowerscripts.core/lib/sfdxwrappers/ValidateDXUnlockedPackageImpl";
import { AppInsights } from "../Common/AppInsights";

async function run() {
  try {
    const validate_package: string = tl.getInput("package", false);
    const project_directory: string = tl.getInput("working_directory", false);
    const bypass: string = tl.getInput("bypass", false);

    AppInsights.setupAppInsights(tl.getBoolInput("isTelemetryEnabled",true));

    
    
    let validateApexCoverageImpl:ValidateDXUnlockedPackageImpl = new ValidateDXUnlockedPackageImpl(validate_package,bypass,project_directory);
    console.log("Generating command");
    let command = await validateApexCoverageImpl.buildExecCommand();
    tl.debug(command);
    await validateApexCoverageImpl.exec(command);

    AppInsights.trackTask("sfpwowerscript-validatedxunlockedpackage-task");
    AppInsights.trackTaskEvent("sfpwowerscript-validatedxunlockedpackage-task","unlocked_package_validated");    



  } catch (err) {
    AppInsights.trackExcepiton("sfpwowerscript-validatedxunlockedpackage-task",err);    
    tl.setResult(tl.TaskResult.Failed, err.message);
  }
}

run();
