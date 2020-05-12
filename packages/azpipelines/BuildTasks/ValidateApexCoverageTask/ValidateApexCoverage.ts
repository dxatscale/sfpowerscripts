import tl = require("azure-pipelines-task-lib/task");
import ValidateApexCoverageImpl from "@dxatscale/sfpowerscripts.core/lib/sfdxwrappers/ValidateApexCoverageImpl";
import { AppInsights } from "../Common/AppInsights";

async function run() {
  try {

    const target_org: string = tl.getInput("target_org", true);
    const test_coverage: string = tl.getInput("test_coverage", true);
    AppInsights.setupAppInsights(tl.getBoolInput("isTelemetryEnabled",true));
    
    
    let validateApexCoverageImpl:ValidateApexCoverageImpl = new ValidateApexCoverageImpl(target_org,Number(test_coverage));
    console.log("Generating command");
    let command = await validateApexCoverageImpl.buildExecCommand();
    tl.debug(command);
    await validateApexCoverageImpl.exec(command);

    
 AppInsights.trackTask("sfpwowerscript-validateapextestcoverage-task");
 AppInsights.trackTaskEvent("sfpwowerscript-validateapextestcoverage-task","apex_testcoverage_validated");    

  } catch (err) {
    AppInsights.trackExcepiton("sfpwowerscript-validateapextestcoverage-task",err);    
    tl.setResult(tl.TaskResult.Failed, err.message);
  }
}

run();
