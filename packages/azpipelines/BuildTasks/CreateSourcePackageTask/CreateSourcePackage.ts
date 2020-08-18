import tl = require("azure-pipelines-task-lib/task");
import PackageDiffImpl from "@dxatscale/sfpowerscripts.core/lib/sfdxwrappers/PackageDiffImpl";
import CreateSourcePackageImpl from "@dxatscale/sfpowerscripts.core/lib/sfdxwrappers/CreateSourcePackageImpl";
import PackageMetadata from "@dxatscale/sfpowerscripts.core/lib/sfdxwrappers/PackageMetadata";
const fs = require("fs");
import { isNullOrUndefined } from "util";
const path = require("path");

async function run() {
  try {
    let sfdx_package: string = tl.getInput("package", true);
    let version_number: string = tl.getInput("version_number", true);
    let isDiffCheck: boolean = tl.getBoolInput("isDiffCheck", false);
    let isGitTag: boolean = tl.getBoolInput("isGitTag", false);
    let project_directory: string = tl.getInput("project_directory", false);
    let apextestsuite = tl.getInput("apextestsuite", false);
    let destructiveManifestFilePath=tl.getInput("destructiveManifestFilepath",false);
    let commit_id = tl.getVariable("build.sourceVersion");
    let repository_url = tl.getVariable("build.repository.uri");

    let isRunBuild: boolean;
    if (isDiffCheck) {
      console.log("Heading to package Diff Impl");

      let packageDiffImpl = new PackageDiffImpl(
        sfdx_package,
        project_directory
      );

      isRunBuild = await packageDiffImpl.exec();

      if (isRunBuild)
        console.log(
          `Detected changes to ${sfdx_package} package...proceeding\n`
        );
      else
        console.log(
          `No changes detected for ${sfdx_package} package...skipping\n`
        );
    } else isRunBuild = true;

    if (isRunBuild) {
 

      //Upload Metadata Artifact
      let packageMetadata:PackageMetadata = {
        package_name: sfdx_package,
        package_version_number: version_number,
        sourceVersion: commit_id,
        repository_url: repository_url,
        package_type: "source",
        apextestsuite:apextestsuite
      };

      //Convert to MDAPI
      let createSourcePackageImpl = new CreateSourcePackageImpl(
        project_directory,
        sfdx_package,
        destructiveManifestFilePath,
        packageMetadata
      );
      packageMetadata = await createSourcePackageImpl.exec();

      if (packageMetadata.isApexFound && isNullOrUndefined(apextestsuite)) {
        tl.logIssue(
          tl.IssueType.Warning,
          "This package has apex classes/triggers and an apex test suite is not specified, You would not be able to deply to production if each class do not have coverage of 75% and above"
        );
      }

      let artifactFileName: string = `/${sfdx_package}_artifact_metadata`;
      fs.writeFileSync(__dirname + artifactFileName, JSON.stringify(packageMetadata));
      let data = {
        artifacttype: "container",
        artifactname: "sfpowerkit_artifact",
      };
      // upload or copy
      data["containerfolder"] = "sfpowerkit_artifact";
      // add localpath to ##vso command's properties for back compat of old Xplat agent
      data["localpath"] = __dirname + artifactFileName;
      tl.command("artifact.upload", data, __dirname + artifactFileName);



    //Upload Source Artifact
      let taskType = tl.getVariable("Release.ReleaseId") ? "Release" : "Build";
      let artifactFilePath: string = "";

      if (taskType == "Build") {
        artifactFilePath = path.join(
          tl.getVariable("build.repository.localpath"),
          packageMetadata.sourceDir
        );
      } else {
        artifactFilePath = path.join(
          project_directory,
          packageMetadata.sourceDir
        );
        tl.debug("Artifact written to"+artifactFilePath);
      }

      tl.command(
        "artifact.upload",
        { artifactname: `${sfdx_package}_sfpowerscripts_source_package` },
        artifactFilePath
      );

      tl.setVariable("sfpowerscripts_package_version_number", version_number);
      tl.setVariable(
        "sfpowerscripts_source_package_metadata_path",
        __dirname + artifactFileName
      );
      tl.setVariable(
        "sfpowerscripts_source_package_path",
        artifactFilePath
      );


      //Create Git Tag
      if (isGitTag) {
        let tagname: string = `${sfdx_package}_v${version_number}`;
        tl.setVariable(`${sfdx_package}_sfpowerscripts_git_tag`, tagname);
        if (isNullOrUndefined(project_directory))
          tl.setVariable(
            `${sfdx_package}_sfpowerscripts_project_directory_path`,
            tl.getVariable("Build.Repository.LocalPath")
          );
        else
          tl.setVariable(
            `${sfdx_package}_sfpowerscripts_project_directory_path`,
            project_directory
          );
      }
    }
  } catch (err) {
    tl.setResult(tl.TaskResult.Failed, err.message);
  }
}

run();
