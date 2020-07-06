import tl = require("azure-pipelines-task-lib/task");
import ValidateTestCoveragePackageImpl from "@dxatscale/sfpowerscripts.core/lib/sfdxwrappers/ValidateTestCoveragePackageImpl";
import { isNullOrUndefined } from "util";


async function run() {
  try {
    const target_org: string = tl.getInput("target_org", true);
    const test_coverage: string = tl.getInput("test_coverage", true);
    const package_version_id: string = tl.getInput("package_version_id", true);


    if( isNullOrUndefined(package_version_id)  || !package_version_id.startsWith("04t"))
    {
      tl.setResult(tl.TaskResult.Failed, "Invalid Package Id Provided, Check Inputs");
      return;
    }

    let validateCodeCoverageImpl: ValidateTestCoveragePackageImpl = new ValidateTestCoveragePackageImpl(
      target_org,
      Number(test_coverage),
      package_version_id
    );
    console.log("Generating command");
    let command = await validateCodeCoverageImpl.buildExecCommand();
    tl.debug(command);
    await validateCodeCoverageImpl.exec(command);

  } catch (err) {
    tl.setResult(tl.TaskResult.Failed, err.message);
  }
}

run();
