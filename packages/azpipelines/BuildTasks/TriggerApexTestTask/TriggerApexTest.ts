import tl = require("azure-pipelines-task-lib/task");
import TriggerApexTestImpl from "@dxatscale/sfpowerscripts.core/lib/sfdxwrappers/TriggerApexTestImpl";
import path = require("path");

async function run() {
  let test_options = {};

  try {
    const target_org: string = tl.getInput("target_org", true);
    const project_directory: string = tl.getInput("project_directory", false);

    test_options["wait_time"] = tl.getInput("wait_time", true);
    test_options["testlevel"] = tl.getInput("testlevel", true);
    test_options["synchronous"] = tl.getBoolInput("synchronous", false);
    test_options["coverageThreshold"] = parseInt(tl.getInput("coverageThreshold", false), 10);
    test_options["package"] = tl.getInput("package", false);
    test_options["validateIndividualClassCoverage"] = tl.getBoolInput("validateIndividualClassCoverage", false);
    test_options["validatePackageCoverage"] = tl.getBoolInput("validatePackageCoverage", false);

    // Input validation
    if (
      test_options["testlevel"] === "RunAllTestsInPackage" &&
      test_options["package"] == null
    ) {
      throw new Error("Package name must be specified when test level is RunAllTestsInPackage");
    } else if (
      (test_options["validateIndividualClassCoverage"] || test_options["validatePackageCoverage"]) &&
      test_options["testlevel"] !== "RunAllTestsInPackage"
    ) {
      throw new Error("Code coverage validation is only available for test level RunAllTestsInPackage");
    }



    if (test_options["testlevel"] == "RunSpecifiedTests")
      test_options["specified_tests"] = tl.getInput("specified_tests", true);
    if (test_options["testlevel"] == "RunApexTestSuite")
      test_options["apextestsuite"] = tl.getInput("apextestsuite", true);

    let taskType = tl.getVariable("Release.ReleaseId") ? "Release" : "Build";
    let stagingDir: string = "";

    if (taskType == "Build") {
      stagingDir = path.join(
        tl.getVariable("build.artifactStagingDirectory")?tl.getVariable("build.artifactStagingDirectory"):"staging",
        ".testresults"
      );

      console.log(stagingDir);
    } else {
      stagingDir = path.join(".testresults");
      console.log(stagingDir);
    }

    test_options["outputdir"] = stagingDir;

    let triggerApexTestImpl: TriggerApexTestImpl = new TriggerApexTestImpl(
      target_org,
      test_options,
      project_directory
    );
    console.log("Executing command");
    let result = await triggerApexTestImpl.exec();

    if (!result.result) {
      tl.setResult(tl.TaskResult.Failed, result.message);
    } else {
      tl.setResult(tl.TaskResult.Succeeded, result.message);
    }

  } catch (err) {
    tl.setResult(tl.TaskResult.Failed, err.message);
  }
}
run();
