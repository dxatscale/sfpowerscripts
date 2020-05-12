import tl = require("azure-pipelines-task-lib/task");
import ValidateTestCoveragePackageImpl from "@dxatscale/sfpowerscripts.core/lib/sfdxwrappers/ValidateTestCoveragePackageImpl";
import { AppInsights } from "../Common/AppInsights";

async function run() {
  try {
    const target_org: string = tl.getInput("target_org", true);
    const test_coverage: string = tl.getInput("test_coverage", true);
    const package_version_id: string = tl.getInput("package_version_id", true);
    AppInsights.setupAppInsights(tl.getBoolInput("isTelemetryEnabled", true));

    let validateCodeCoverageImpl: ValidateTestCoveragePackageImpl = new ValidateTestCoveragePackageImpl(
      target_org,
      Number(test_coverage),
      package_version_id
    );
    console.log("Generating command");
    let command = await validateCodeCoverageImpl.buildExecCommand();
    tl.debug(command);
    await validateCodeCoverageImpl.exec(command);

    AppInsights.trackTask("sfpwowerscript-validatetestcoveragepackage-task");
    AppInsights.trackTaskEvent(
      "sfpwowerscript-validatetestcoveragepackage-task",
      "code_coverage_validated"
    );
  } catch (err) {
    AppInsights.trackExcepiton(
      "sfpwowerscript-validatetestcoveragepackage-task",
      err
    );
    tl.setResult(tl.TaskResult.Failed, err.message);
  }
}

run();
