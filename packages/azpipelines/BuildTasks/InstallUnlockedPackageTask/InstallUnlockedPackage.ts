import tl = require("azure-pipelines-task-lib/task");
import InstallUnlockedPackageImpl from "@dxatscale/sfpowerscripts.core/lib/sfdxwrappers/InstallUnlockedPackageImpl";
var fs = require("fs");
const path = require("path");

async function run() {
  try {
    const envname: string = tl.getInput("envname", true);
    const sfdx_package: string = tl.getInput("package", true);
    const package_installedfrom = tl.getInput("packageinstalledfrom", true);
    const artifact = tl.getInput("artifact", true);
    let package_version_id:string;

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

      let package_metadata_json = fs
        .readFileSync(package_version_id_file_path)
        .toString();
      let package_metadata = JSON.parse(package_metadata_json);
      console.log("Package Metadata:");
      console.log(package_metadata);

      package_version_id = package_metadata.package_version_id;
      console.log(`Using Package Version Id ${package_version_id}`);
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
      upgradetype: upgrade_type,
    };

    let installUnlockedPackageImpl: InstallUnlockedPackageImpl = new InstallUnlockedPackageImpl(
      package_version_id,
      envname,
      options,
      wait_time,
      publish_wait_time
    );

    await installUnlockedPackageImpl.exec();
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

  console.log(`Checking for ${sfdx_package} Build Artifact at path ${package_version_id_file_path}`);
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

    existsPackageVersionIdFilePath(package_version_id_file_path);
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

  console.log(`Checking for ${sfdx_package} Azure Artifact at path ${package_version_id_file_path}`);
  existsPackageVersionIdFilePath(package_version_id_file_path);

  return package_version_id_file_path;
}

function existsPackageVersionIdFilePath(package_version_id_file_path: string): void {
  let skip_on_missing_artifact = tl.getBoolInput("skip_on_missing_artifact", false);

  if (!fs.existsSync(package_version_id_file_path) && !skip_on_missing_artifact) {
    throw new Error(
      `Artifact not found at ${package_version_id_file_path}.. Please check the inputs`
    );
  } else if(!fs.existsSync(package_version_id_file_path) && skip_on_missing_artifact) {
    tl.setResult(tl.TaskResult.Skipped, `Skipping task as artifact is missing, and 'Skip If no artifact is found' ${skip_on_missing_artifact}`);
    process.exit(0);
  }
}

run();
