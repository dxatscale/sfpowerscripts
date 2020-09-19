import tl = require("azure-pipelines-task-lib/task");
var fs = require("fs-extra");
const path = require("path");
import simplegit from "simple-git/promise";
import { isNullOrUndefined } from "util";
var shell = require("shelljs");
import ArtifactFilePathFetcher from "../Common/ArtifactFilePathFetcher";
import PackageMetadata from "@dxatscale/sfpowerscripts.core/lib/PackageMetadata";

async function run() {
  try {


    let artifact_directory = tl.getVariable("system.artifactsDirectory");
    const artifact = tl.getInput("artifact", true);
    const artifactProvider = tl.getInput("artifactProvider", true);
    let sfdx_package = tl.getInput("package", false);
    let skip_on_missing_artifact: boolean = tl.getBoolInput("skip_on_missing_artifact",false);


    let version_control_provider: string;
    let token: string;
    let username: string;

    //Read Git User Endpoint
      version_control_provider = tl.getInput("versionControlProvider", true);

      let connection: string;
      let vcsAuthDetails = getVCSAuthDetails(version_control_provider, connection);
      token=vcsAuthDetails.token;
      username=vcsAuthDetails.username;

     //Fetch Artifact
    let artifactFilePaths = ArtifactFilePathFetcher.fetchArtifactFilePaths(
      artifact,
      artifactProvider,
      sfdx_package
    );

    ArtifactFilePathFetcher.missingArtifactDecider(
      artifactFilePaths[0].packageMetadataFilePath,
      skip_on_missing_artifact
    );


      //Read package metadata
      let packageMetadataFromArtifact: PackageMetadata = JSON.parse(fs.readFileSync(artifactFilePaths[0].packageMetadataFilePath, "utf8"));


      console.log("##[command]Package Metadata:"+JSON.stringify(packageMetadataFromArtifact,(key:string,value:any)=>{
        if(key=="payload")
          return undefined;
        else
           return value;
     }));



    //Create Location

    //For Backward Compatibility, packageName could be null when upgraded
    let local_source_directory = isNullOrUndefined(sfdx_package)
      ? path.join(artifact_directory, artifact, "source")
      : path.join(artifact_directory, artifact, sfdx_package, "source");

    shell.mkdir("-p", local_source_directory);

    console.log(`Source Directory created at ${local_source_directory}`);


    if (
      packageMetadataFromArtifact.package_type === "source" ||
      packageMetadataFromArtifact.package_type === "unlocked"
    ) {
      //Strinp https
      const removeHttps = (input) => input.replace(/^https?:\/\//, "");

      let repository_url = removeHttps(packageMetadataFromArtifact.repository_url);

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
          .clone(packageMetadataFromArtifact.repository_url, local_source_directory);
      else await git.silent(false).clone(remote, local_source_directory);

      //Checkout the particular commit
      await git.checkout(packageMetadataFromArtifact.sourceVersion);

      console.log(`Checked Out ${packageMetadataFromArtifact.sourceVersion} sucessfully`);
    } else if (packageMetadataFromArtifact.package_type === "delta") {

      let delta_artifact_location;
      if(!isNullOrUndefined(artifactFilePaths[0].sourceDirectoryPath))
      {
        delta_artifact_location=artifactFilePaths[0].sourceDirectoryPath;
      }

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

function getVCSAuthDetails(version_control_provider: string, connection: string) {

  let token,username;
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
  }
  else if (version_control_provider == "github" ||
    version_control_provider == "githubEnterprise") {
    token = tl.getEndpointAuthorizationParameter(
      connection,
      "AccessToken",
      true
    );
  }
  else if (version_control_provider == "bitbucket") {
    token = tl.getEndpointAuthorizationParameter(
      connection,
      "AccessToken",
      true
    );
  }
  else if (version_control_provider == "otherGit") {
    username = tl.getInput("username", true);
    token = tl.getInput("password", true);
  }
  return {token, username };
}


run();
