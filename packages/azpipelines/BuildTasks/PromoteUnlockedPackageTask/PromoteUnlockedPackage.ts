import tl = require("azure-pipelines-task-lib/task");
import PromoteUnlockedPackageImpl from "@dxatscale/sfpowerscripts.core/lib/sfdxwrappers/PromoteUnlockedPackageImpl";
var fs = require("fs");
const path = require("path");
import { AppInsights } from "../Common/AppInsights";

async function run() {
  try {
    console.log(`SFPowerScript.. Promote Unlocked Package`);

    const package_installedfrom = tl.getInput("packagepromotedfrom", true);
    const sfdx_package: string = tl.getInput("package", true);
    let devhub_alias = tl.getInput("devhub_alias", true);

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

      console.log(`Checking for directory ${package_version_id_file_path}`);

      //Fallback to older format
      if (!fs.existsSync(package_version_id_file_path)) {
        package_version_id_file_path = path.join(
          artifact_directory,
          artifact,
          "sfpowerkit_artifact",
          "artifact_metadata"
        );
      }

      let package_metadata_json = fs
        .readFileSync(package_version_id_file_path)
        .toString();

      let package_metadata = JSON.parse(package_metadata_json);

      package_version_id = package_metadata.package_version_id;

      console.log(`Found Package Version Id in artifact ${package_version_id}`);
    } else {
      package_version_id = tl.getInput("package_version_id", false);
    }

 

    let promoteUnlockedPackageImpl: PromoteUnlockedPackageImpl = new PromoteUnlockedPackageImpl(
      package_version_id,
      devhub_alias
    );

    await promoteUnlockedPackageImpl.exec();

    AppInsights.trackTask("sfpwowerscript-promoteunlockedpackage-task");
    AppInsights.trackTaskEvent(
      "sfpwowerscript-promoteunlockedpackage-task",
      "package_oromoted"
    );
  } catch (err) {
    AppInsights.trackExcepiton(
      "sfpwowerscript-promoteunlockedpackage-task",
      err
    );
    tl.setResult(tl.TaskResult.Failed, err.message);
  }
}

run();
