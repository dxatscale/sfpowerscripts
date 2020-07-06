import tl = require("azure-pipelines-task-lib/task");
var fs = require("fs-extra");
const path = require("path");
import simplegit from "simple-git/promise";
import { isNullOrUndefined } from "util";
var shell = require("shelljs");

async function run() {
  try {
    let artifact_directory = tl.getVariable("system.artifactsDirectory");
    const artifact = tl.getInput("artifact", true);
    const artifact_type = tl.getInput("typeOfArtifact", true);
    const artifactProvider = tl.getInput("artifactProvider", true);
    let packageName = tl.getInput("package", false);
    let skip_on_missing_artifact: boolean = tl.getBoolInput("skip_on_missing_artifact",false);

    let package_version_id_file_path: string;
    let version_control_provider: string;
    let token: string;
    let username: string;

    //Read Git User Endpoint
    if (artifact_type != "delta") {
      version_control_provider = tl.getInput("versionControlProvider", true);

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
      } else if (version_control_provider == "otherGit") {
        username = tl.getInput("username", true);
        token = tl.getInput("password", true);
      }
    }

    //For Backward Compatibility, packageName could be null when upgraded
    let artifactFileNameSelector = isNullOrUndefined(packageName)
      ? "artifact_metadata"
      : packageName + "_artifact_metadata";

    if (artifactProvider == "AzureArtifact") {
      package_version_id_file_path = fetchArtifactFilePathFromAzureArtifact(
        artifact_directory,
        artifact,
        artifactFileNameSelector
      );
    } else if (artifactProvider == "BuildArtifact") {
      package_version_id_file_path = fetchArtifactFilePathFromBuildArtifact(
        artifact_directory,
        artifact,
        artifactFileNameSelector
      );
    }

    missingArtifactDecider(package_version_id_file_path, skip_on_missing_artifact);

    let package_metadata_json = fs
      .readFileSync(package_version_id_file_path)
      .toString();

    let package_metadata = JSON.parse(package_metadata_json);

    //Create Location

    //For Backward Compatibility, packageName could be null when upgraded
    let local_source_directory = isNullOrUndefined(packageName)
      ? path.join(artifact_directory, artifact, "source")
      : path.join(artifact_directory, artifact, packageName, "source");

    shell.mkdir("-p", local_source_directory);

    console.log(`Source Directory created at ${local_source_directory}`);
    console.log(`The Package Type : ${package_metadata.package_type}`);

    if (
      package_metadata.package_type === "source" ||
      package_metadata.package_type === "unlocked"
    ) {
      //Strinp https
      const removeHttps = (input) => input.replace(/^https?:\/\//, "");

      let repository_url = removeHttps(package_metadata.repository_url);

      const git = simplegit(local_source_directory);

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

      // git already authenticated.. say hosted agent.. get the repository_url directly from the artifact
      if (version_control_provider == "hostedAgentGit")
        await git
          .silent(false)
          .clone(package_metadata.repository_url, local_source_directory);
      else await git.silent(false).clone(remote, local_source_directory);

      //Checkout the particular commit
      await git.checkout(package_metadata.sourceVersion);

      console.log(`Checked Out ${package_metadata.sourceVersion} sucessfully`);
    } else if (package_metadata.package_type === "delta") {
      //For Backward Compatibility, packageName could be null when upgraded
      let delta_artifact_location = isNullOrUndefined(packageName)
        ? path.join(
            artifact_directory,
            artifact,
            "sfpowerscripts_delta_package"
          )
        : path.join(
            artifact_directory,
            artifact,
            `${packageName}_sfpowerscripts_delta_package`
          );

      tl.debug(`Delta Directory is at ${delta_artifact_location}`);

      tl.debug("Files in Delta Location");
      fs.readdirSync(delta_artifact_location).forEach((file) => {
        tl.debug(file);
      });

      tl.debug("Copying Files to a source directory");
      fs.copySync(delta_artifact_location, local_source_directory, {
        overwrite: true,
      });
    }

    console.log("Files in source Location");
    fs.readdirSync(local_source_directory).forEach((file) => {
      console.log(file);
    });

    tl.setVariable("sfpowerscripts_checked_out_path", local_source_directory);
  } catch (err) {
    tl.setResult(tl.TaskResult.Failed, err.message);
  }
}

function fetchArtifactFilePathFromBuildArtifact(
  artifact_directory: string,
  artifact: string,
  artifactFileNameSelector: string
): string {

  let package_version_id_file_path = path.join(
    artifact_directory,
    artifact,
    "sfpowerkit_artifact",
    artifactFileNameSelector
  );

  console.log(
    `Checking for ${artifactFileNameSelector} Build Artifact at path ${package_version_id_file_path}`
  );
  return package_version_id_file_path;
}

function fetchArtifactFilePathFromAzureArtifact(
  artifact_directory: string,
  artifact: string,
  artifactFileNameSelector: string
): string {

  let package_version_id_file_path = path.join(
    artifact_directory,
    artifact,
    artifactFileNameSelector
  );

  console.log(
    `Checking for ${artifactFileNameSelector} Azure Artifact at path ${package_version_id_file_path}`
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
    console.log(`Skipping task as artifact is missing, and 'Skip If no artifact is found' ${skip_on_missing_artifact}`);
    tl.setResult(
      tl.TaskResult.Skipped,
      `Skipping task as artifact is missing, and 'Skip If no artifact is found' ${skip_on_missing_artifact}`
    );
    process.exit(0);
  }
}

run();
