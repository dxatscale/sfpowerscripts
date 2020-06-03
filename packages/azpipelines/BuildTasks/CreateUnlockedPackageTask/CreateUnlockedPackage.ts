import tl = require("azure-pipelines-task-lib/task");
import CreateUnlockedPackageImpl from "@dxatscale/sfpowerscripts.core/lib/sfdxwrappers/CreateUnlockedPackageImpl"
const fs = require("fs");
import { AppInsights } from "../Common/AppInsights";

async function run() {
  try {

    AppInsights.setupAppInsights(tl.getBoolInput("isTelemetryEnabled",true));
    AppInsights.trackTask("sfpwowerscripts-createunlockedpackage-task");


    let sfdx_package: string = tl.getInput("package", true);
    let version_number: string = tl.getInput("version_number", false);
    let tag: string = tl.getInput("tag", false);
    let config_file_path = tl.getInput("config_file_path", true);
    let installationkeybypass = tl.getBoolInput("installationkeybypass", true);
    let isCoverageEnabled:boolean = tl.getBoolInput("enable_coverage",true);
    let isSkipValidation:boolean = tl.getBoolInput("isValidationToBeSkipped",true);
    const set_build_number: boolean = tl.getBoolInput("set_build_number",true);

    let installationkey;

    if (!installationkeybypass)
      installationkey = tl.getBoolInput("installationkey", true);

    let project_directory = tl.getInput("project_directory", false);
    let devhub_alias = tl.getInput("devhub_alias", true);
    let wait_time = tl.getInput("wait_time", true);

    let build_artifact_enabled = tl.getBoolInput(
      "build_artifact_enabled",
      true
    );

   

    let createUnlockedPackageImpl: CreateUnlockedPackageImpl = new CreateUnlockedPackageImpl(
      sfdx_package,
      version_number,
      tag,
      config_file_path,
      installationkeybypass,
      installationkey,
      project_directory,
      devhub_alias,
      wait_time,
      isCoverageEnabled,
      isSkipValidation
    );

    let command: string = await createUnlockedPackageImpl.buildExecCommand();

    console.log(`Package Creation Command: ${command}`)

    let result:{packageVersionId:string,versionNumber:string, testCoverage:number,hasPassedCoverageCheck:boolean} = await createUnlockedPackageImpl.exec(
      command
    );

    tl.setVariable("sfpowerscripts_package_version_id", result.packageVersionId);

    AppInsights.trackTaskEvent("sfpwowerscripts-createunlockedpackage-task","created_package");

    if (set_build_number) {
      console.log(`Updating build number to ${result.versionNumber}`);
      tl.updateBuildNumber(result.versionNumber);
    }



    if (build_artifact_enabled) {

      let repository_url = tl.getVariable("build.repository.uri");
      let commit_id = tl.getVariable("build.sourceVersion");


      let metadata = {
        package_name: sfdx_package,
        package_version_number: result.versionNumber,
        package_version_id: result.packageVersionId,
        sourceVersion: commit_id,
        repository_url:repository_url,
        test_coverage:result.testCoverage,
        has_passed_coverage_check:result.hasPassedCoverageCheck,
        package_type:"unlocked"
     };

     let artifactFileName:string = `/${sfdx_package}_artifact_metadata`;

      fs.writeFileSync(__dirname + artifactFileName, JSON.stringify(metadata));

      let data = {
        artifacttype: "container",
        artifactname: "sfpowerkit_artifact"
      };

      // upload or copy
      data["containerfolder"] = "sfpowerkit_artifact";

      // add localpath to ##vso command's properties for back compat of old Xplat agent
      data["localpath"] = __dirname + artifactFileName;
      tl.command("artifact.upload", data, __dirname + artifactFileName);
    }
  } catch (err) {
    AppInsights.trackExcepiton("sfpwowerscripts-createunlockedpackage-task",err);
    tl.setResult(tl.TaskResult.Failed, err.message);
  }
}

run();
