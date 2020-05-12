import tl = require("azure-pipelines-task-lib/task");
import InstallUnlockedPackageImpl from "@dxatscale/sfpowerscripts.core/lib/sfdxwrappers/InstallUnlockedPackageImpl";
var fs = require("fs");
const path = require("path");

import { AppInsights } from "../Common/AppInsights";

async function run() {
  try {
    const envname: string = tl.getInput("envname", true);
    const sfdx_package: string = tl.getInput("package", true);

    const package_installedfrom = tl.getInput("packageinstalledfrom", true);
    AppInsights.setupAppInsights(tl.getBoolInput("isTelemetryEnabled", true));

    let package_version_id;

    if (package_installedfrom == "BuildArtifact") {
      //Figure out the id from the artifact

      const artifact = tl.getInput("artifact", true);

      let artifact_directory = tl.getVariable("system.artifactsDirectory");

      //Newer metadata filename
      let package_version_id_file_path;

      package_version_id_file_path = path.join(
        artifact_directory,
        artifact,
        "sfpowerkit_artifact",
        `${sfdx_package}_artifact_metadata`
      );

      //Fallback to older format
      if (!fs.existsSync(package_version_id_file_path)) {

        console.log("Falling back to older artifact format");
        package_version_id_file_path = path.join(
          artifact_directory,
          artifact,
          "sfpowerkit_artifact",
          `artifact_metadata`
        );
      }

     

      let package_metadata_json = fs
        .readFileSync(package_version_id_file_path)
        .toString();

       

      let package_metadata = JSON.parse(package_metadata_json);
      console.log("Package Metadata:");
      console.log(package_metadata);
      

      package_version_id = package_metadata.package_version_id;

      console.log(`Using Package Version Id ${package_version_id}`);

      AppInsights.trackTaskEvent(
        "sfpwowerscript-installunlockedpackage-task",
        "using_artifact"
      );
    } else {
      package_version_id = tl.getInput("package_version_id", false);
      AppInsights.trackTaskEvent(
        "sfpwowerscript-installunlockedpackage-task",
        "using_id"
      );
    }

    const installationkey = tl.getInput("installationkey", false);
    const apexcompileonlypackage = tl.getInput("apexcompileonlypackage", false);
    const security_type = tl.getInput("security_type", false);
    const upgrade_type = tl.getInput("upgrade_type", false);
    const wait_time = tl.getInput("wait_time", false);
    const publish_wait_time = tl.getInput("publish_wait_time", false);

    let apexcompile;
    if (apexcompileonlypackage) apexcompile = `package`;
    else apexcompile = `all`;

    let options = {
      installationkey: installationkey,
      apexcompile: apexcompile,
      securitytype: security_type,
      upgradetype: upgrade_type
    };

    let installUnlockedPackageImpl: InstallUnlockedPackageImpl = new InstallUnlockedPackageImpl(
      package_version_id,
      envname,
      options,
      wait_time,
      publish_wait_time
    );

    await installUnlockedPackageImpl.exec();
    AppInsights.trackTask("sfpwowerscript-installunlockedpackage-task");
  } catch (err) {
    AppInsights.trackTaskEvent(
      "sfpwowerscript-installunlockedpackage-task",
      err
    );
    tl.setResult(tl.TaskResult.Failed, err.message);
  }
}

run();
