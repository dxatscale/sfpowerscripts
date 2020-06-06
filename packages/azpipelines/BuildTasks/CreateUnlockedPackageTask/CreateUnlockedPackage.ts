import tl = require("azure-pipelines-task-lib/task");
import CreateUnlockedPackageImpl from "@dxatscale/sfpowerscripts.core/lib/sfdxwrappers/CreateUnlockedPackageImpl";
import PackageDiffImpl from "@dxatscale/sfpowerscripts.core/lib/sfdxwrappers/PackageDiffImpl";
const fs = require("fs");
import { AppInsights } from "../Common/AppInsights";
import simplegit from "simple-git/promise";

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
    let isDiffCheck: boolean = tl.getBoolInput("isDiffCheck", false);
    let isGitTag: boolean = tl.getBoolInput("isGitTag", false);
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

    let isRunBuild: boolean;
    if (isDiffCheck) {
      let packageDiffImpl = new PackageDiffImpl(sfdx_package, project_directory);

      isRunBuild = await packageDiffImpl.exec();

      if (isRunBuild)
        console.log(`Detected changes to ${sfdx_package} package...proceeding`);
      else
        console.log(`No changes detected for ${sfdx_package} package...skipping`);

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

      if (isGitTag) {
        let tagname: string = `${sfdx_package}_v${result.versionNumber}`;
        await pushGitTag(tagname);
      }

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
    }
  } catch (err) {
    AppInsights.trackExcepiton("sfpwowerscripts-createunlockedpackage-task",err);
    tl.setResult(tl.TaskResult.Failed, err.message);
  }
}

async function pushGitTag(tagname: string): Promise<void> {
  const version_control_provider: string = tl.getInput(
    "versionControlProvider",
    true
  );

  let connection: string;
  switch (version_control_provider) {
    case "github":
    connection = tl.getInput("github_connection", true);
    break;
    case "githubEnterprise":
    connection = tl.getInput("github_enterprise_connection", true);
    break;
    case "bitbucket":
    connection = tl.getInput("bitbucket_connection", true);
    break;
  }

  let token;
  let username: string;
  if (version_control_provider == "azureRepo") {
      token = tl.getVariable("system.accessToken");
  } else if (
      version_control_provider == "github" ||
      version_control_provider == "githubEnterprise"
  ) {
      token = tl.getEndpointAuthorizationParameter(
      connection,
      "AccessToken",
      true
      );
  } else if (version_control_provider == "bitbucket") {
      token = tl.getEndpointAuthorizationParameter(
      connection,
      "AccessToken",
      true
      );
  } else {
      username = tl.getInput("username", true);
      token = tl.getInput("password", true);
  }
  //Strip https
  const removeHttps = input => input.replace(/^https?:\/\//, "");

  let repository_url = removeHttps(
      tl.getVariable("Build.Repository.Uri")
  );

  tl.debug(`Repository URL ${repository_url}`);

  const git = simplegit(tl.getVariable("Build.Repository.LocalPath"));

  let remote: string;
  if (version_control_provider == "azureRepo") {
      //Fix Issue https://developercommunity.visualstudio.com/content/problem/411770/devops-git-url.html
      repository_url = repository_url.substring(
      repository_url.indexOf("@") + 1
      );
      remote = `https://x-token-auth:${token}@${repository_url}`;
  } else if (version_control_provider == "bitbucket") {
      remote = `https://x-token-auth:${token}@${repository_url}`;
  } else if (
      version_control_provider == "github" ||
      version_control_provider == "githubEnterprise"
  ) {
      remote = `https://${token}:x-oauth-basic@${repository_url}`;
  } else if (version_control_provider == "otherGit") {
      remote = `https://${username}:${token}@${repository_url}`;
  }

  await git
        .silent(false)
        .addAnnotatedTag(
          tagname,
          'Unlocked Package'
        );

  await git
      .silent(false)
      .push(
        remote,
        tagname
      );
}

run();
