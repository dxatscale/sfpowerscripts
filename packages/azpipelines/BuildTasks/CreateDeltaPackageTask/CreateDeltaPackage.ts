import tl = require("azure-pipelines-task-lib/task");
import { isNullOrUndefined } from "util";
import CreateDeltaPackageImpl from "@dxatscale/sfpowerscripts.core/lib/sfdxwrappers/CreateDeltaPackageImpl";
const path = require("path");
const fs = require("fs");

async function run() {
  try {
    const sfdx_package = tl.getInput("package", true);
    const projectDirectory = tl.getInput("project_directory", false);
    const versionName: string = tl.getInput("version_name", false);
    const setBuildName: boolean = tl.getBoolInput("set_build_name",true);



    let revisionFrom: string = tl.getInput("revision_from", true);
    let revision_to: string = tl.getInput("revision_to", false);
    let options:any = {};

    options['bypass_directories']=tl.getInput("bypass_directories", false);
    options['only_diff_for']=tl.getInput("only_diff_for", false);



    if (isNullOrUndefined(revision_to)) {
      revision_to = tl.getVariable("build.sourceVersion");
    }
    const generate_destructivemanifest = tl.getBoolInput(
      "generate_destructivemanifest",
      false
    );
    const build_artifact_enabled = true;

    if (setBuildName) {
      console.log(`Updating build number to ${versionName}`);
      tl.updateBuildNumber(versionName);
    }


    let createDeltaPackageImp = new CreateDeltaPackageImpl(
      projectDirectory,
      sfdx_package,
      revisionFrom,
      revision_to,
      generate_destructivemanifest,
      options
    );
    let command = await createDeltaPackageImp.buildExecCommand();

    tl.debug(`Command Generated ${command}`);
    await createDeltaPackageImp.exec(command);

    let taskType = tl.getVariable("Release.ReleaseId") ? "Release" : "Build";
    let artifactFilePath: string = "";

    if (taskType == "Build") {
      artifactFilePath = path.join(tl.getVariable("build.repository.localpath"),`${sfdx_package}_src_delta`);
    }
    else
    {
      artifactFilePath = path.join(projectDirectory,`${sfdx_package}_src_delta`);
      console.log(artifactFilePath);
    }

    tl.setVariable("sfpowerscripts_delta_package_path", artifactFilePath);

    if (build_artifact_enabled && taskType == "Build") {


      //Write Artifact  Delta

       tl.command(
      "artifact.upload",
      { artifactname: `${sfdx_package}_sfpowerscripts_delta_package` },
      artifactFilePath
    );


      //Write artifact Metadata

      let repository_url = tl.getVariable("build.repository.uri");
      let commit_id = tl.getVariable("build.sourceVersion");
      let metadata = {
        package_name: sfdx_package,
        sourceVersion: commit_id,
        repository_url: repository_url,
        package_type: "delta",
        package_version_number: versionName
      };

      let artifactFileName:string = `/${sfdx_package}_artifact_metadata`;

      fs.writeFileSync(
        __dirname + artifactFileName,
        JSON.stringify(metadata)
      );

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
    tl.setResult(tl.TaskResult.Failed, err.message);
  }
}

run();
