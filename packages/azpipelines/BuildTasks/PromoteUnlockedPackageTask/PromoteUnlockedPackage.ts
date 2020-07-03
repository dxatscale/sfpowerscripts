import tl = require("azure-pipelines-task-lib/task");
import PromoteUnlockedPackageImpl from "@dxatscale/sfpowerscripts.core/lib/sfdxwrappers/PromoteUnlockedPackageImpl";
var fs = require("fs");
const path = require("path");

async function run() {
  try {
    console.log(`SFPowerScript.. Promote Unlocked Package`);

    const package_installedfrom = tl.getInput("packagepromotedfrom", true);
    const sfdx_package: string = tl.getInput("package", true);
    const devhub_alias = tl.getInput("devhub_alias", true);
    const projectDirectory = tl.getInput("project_directory", false);
    const artifact = tl.getInput("artifact", true);
    const skip_on_missing_artifact = tl.getBoolInput(
      "skip_on_missing_artifact",
      false
    );

    let package_version_id;

    if (package_installedfrom == "Custom") {
      package_version_id = tl.getInput("package_version_id", false);
    } else {
      let package_version_id_file_path;

      if (package_installedfrom == "BuildArtifact")
        package_version_id_file_path = fetchArtifactFilePathFromBuildArtifact(
          sfdx_package,
          artifact
        );
      else if (package_installedfrom == "AzureArtifact")
        package_version_id_file_path = fetchArtifactFilePathFromAzureArtifact(
          sfdx_package,
          artifact
        );

      missingArtifactDecider(
        package_version_id_file_path,
        skip_on_missing_artifact
      );

   //Read Package_Version_id
     let package_metadata_json = fs
    .readFileSync(package_version_id_file_path)
    .toString();

     let package_metadata = JSON.parse(package_metadata_json);

     package_version_id = package_metadata.package_version_id;
    console.log(`Found Package Version Id in artifact ${package_version_id}`);

    }

   

    let promoteUnlockedPackageImpl: PromoteUnlockedPackageImpl = new PromoteUnlockedPackageImpl(
      projectDirectory,
      package_version_id,
      devhub_alias
    );

    await promoteUnlockedPackageImpl.exec();
  } catch (err) {
    tl.setResult(tl.TaskResult.Failed, err.message);
  }
}

function fetchArtifactFilePathFromBuildArtifact(
  sfdx_package: string,
  artifact: string
): string {
  let artifact_directory = tl.getVariable("system.artifactsDirectory");

  //Newer metadata filename
  let package_version_id_file_path = path.join(
    artifact_directory,
    artifact,
    "sfpowerkit_artifact",
    `${sfdx_package}_artifact_metadata`
  );

  console.log(
    `Checking for ${sfdx_package} Build Artifact at path ${package_version_id_file_path}`
  );
  if (!fs.existsSync(package_version_id_file_path)) {
    console.log(
      `New Artifact format not found at the location ${package_version_id_file_path} `
    );

    console.log("Falling back to older artifact format");
    package_version_id_file_path = path.join(
      artifact_directory,
      artifact,
      "sfpowerkit_artifact",
      `artifact_metadata`
    );
  }

  return package_version_id_file_path;
}

function fetchArtifactFilePathFromAzureArtifact(
  sfdx_package: string,
  artifact: string
): string {
  let artifact_directory = tl.getVariable("system.artifactsDirectory");

  //Newer metadata filename
  let package_version_id_file_path = path.join(
    artifact_directory,
    artifact,
    `${sfdx_package}_artifact_metadata`
  );

  console.log(
    `Checking for ${sfdx_package} Azure Artifact at path ${package_version_id_file_path}`
  );

  return package_version_id_file_path;
}

function missingArtifactDecider(
  package_version_id_file_path: string,
  skip_on_missing_artifact: boolean
): void {
  if (
    !fs.existsSync(package_version_id_file_path) &&
    !skip_on_missing_artifact
  ) {
    throw new Error(
      `Artifact not found at ${package_version_id_file_path}.. Please check the inputs`
    );
  } else if (
    !fs.existsSync(package_version_id_file_path) &&
    skip_on_missing_artifact
  ) {
    console.log(
      `Skipping task as artifact is missing, and 'Skip If no artifact is found' ${skip_on_missing_artifact}`
    );
    tl.setResult(
      tl.TaskResult.Skipped,
      `Skipping task as artifact is missing, and 'Skip If no artifact is found' ${skip_on_missing_artifact}`
    );
    process.exit(0);
  }
}

run();
