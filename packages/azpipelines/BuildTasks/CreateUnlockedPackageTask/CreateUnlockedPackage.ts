import tl = require("azure-pipelines-task-lib/task");
import CreateUnlockedPackageImpl from "@dxatscale/sfpowerscripts.core/lib/sfdxwrappers/CreateUnlockedPackageImpl";
import PackageDiffImpl from "@dxatscale/sfpowerscripts.core/lib/sfdxwrappers/PackageDiffImpl";
const fs = require("fs");
import { isNullOrUndefined } from "util";

async function run() {
  try {


    let sfdx_package: string = tl.getInput("package", true);
    let version_number: string = tl.getInput("version_number", false);
    let tag: string = tl.getInput("tag", false);
    let config_file_path = tl.getInput("config_file_path", true);
    let installationkeybypass = tl.getBoolInput("installationkeybypass", true);
    let isCoverageEnabled:boolean = tl.getBoolInput("enable_coverage",true);
    let isSkipValidation:boolean = tl.getBoolInput("isValidationToBeSkipped",true);
    let isDiffCheckActive: boolean = tl.getBoolInput("isDiffCheck", false);
    let isGitTagActive: boolean = tl.getBoolInput("isGitTag", false);
    const set_build_number: boolean = tl.getBoolInput("set_build_number",true);



    let installationkey;

    if (!installationkeybypass)
      installationkey = tl.getBoolInput("installationkey", true);

    let project_directory = tl.getInput("project_directory", false);
    let devhub_alias = tl.getInput("devhub_alias", true);
    let wait_time = tl.getInput("wait_time", true);

    let build_artifact_enabled = true;

    let isRunBuild: boolean;
    if (isDiffCheckActive) {

      console.log("Heading to package Diff Impl");
      let packageDiffImpl = new PackageDiffImpl(sfdx_package, project_directory, config_file_path);

      isRunBuild = await packageDiffImpl.exec();

      if (isRunBuild)
        console.log(`Detected changes to ${sfdx_package} package...proceeding\n`);
      else
        console.log(`No changes detected for ${sfdx_package} package...skipping\n`);

    } else isRunBuild = true;

    if (isRunBuild) {
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
      tl.setVariable("sfpowerscripts_package_version_number", result.versionNumber);

      if (isGitTagActive) {
         let tagname = `${sfdx_package}_v${result.versionNumber}`;
         tl.setVariable(`${sfdx_package}_sfpowerscripts_git_tag`,tagname);
          if(isNullOrUndefined(project_directory))
            tl.setVariable(`${sfdx_package}_sfpowerscripts_project_directory_path`,tl.getVariable("Build.Repository.LocalPath"));
          else
            tl.setVariable(`${sfdx_package}_sfpowerscripts_project_directory_path`,project_directory);
      }


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
    }
  } catch (err) {
    console.log(err);
    tl.setResult(tl.TaskResult.Failed, err.message);
  }
}


run();
