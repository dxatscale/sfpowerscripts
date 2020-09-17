import tl = require("azure-pipelines-task-lib/task");
import child_process = require("child_process");
import { getWebAPIWithoutToken } from "../Common/WebAPIHelper";
import { IReleaseApi } from "azure-devops-node-api/ReleaseApi";
import { Release, Artifact } from "azure-devops-node-api/interfaces/ReleaseInterfaces";
import ArtifactFilePathFetcher, { ArtifactFilePaths } from "../Common/ArtifactFilePathFetcher";
import PackageMetadata from "@dxatscale/sfpowerscripts.core/lib/PackageMetadata";
import { ReleaseChangelog, Release as ChangelogRelease} from "@dxatscale/sfpowerscripts.core/lib/changelog/interfaces/ReleaseChangelogInterfaces";
import { Changelog as PackageChangelog } from "@dxatscale/sfpowerscripts.core/lib/changelog/interfaces/GenericChangelogInterfaces";

import simplegit, { SimpleGit } from "simple-git/promise";
const tmp = require('tmp');
import fs = require("fs");
const path = require("path");

async function run() {
  const tempDirectories = [];
  try {
    let taskType: string = tl.getVariable("Release.ReleaseId") ? "Release" : "Build";

    if (taskType === "Build") {
      throw Error("Generate Changelog task can only be used on a release pipeline");
    }

    console.log("Cloning repositories...");

    const versionControlProvider: string = tl.getInput("versionControlProvider", true);
    let vcsAuthDetails = getVCSAuthDetails(versionControlProvider);
    let token: string = vcsAuthDetails.token;
    let username: string = vcsAuthDetails.username;


    let tempDir: any = tmp.dirSync({unsafeCleanup: true});

    let defaultRemote: string = buildAuthRemoteUrl(
      versionControlProvider,
      username,
      token,
      tl.getInput("repositoryUrl", true)
    );

    let git: SimpleGit = simplegit();

    await git.clone(
      defaultRemote,
      tempDir.name
    );
    const defaultRepoTempDir = tempDir.name;
    tempDirectories.push(tempDir); // Store temp directories for deletion when process exits

    // Get manifest from branch in default repository
    const branch: string = tl.getInput("branch", true);
    git = simplegit(defaultRepoTempDir);
    await git.checkout(branch);

    console.log(fs.readdirSync(defaultRepoTempDir));


    console.log("Building manifest using latest release definition...");

    const webApi = await getWebAPIWithoutToken();
    const releaseApi: IReleaseApi = await webApi.getReleaseApi();

    let project: string = tl.getVariable('System.TeamProject');
    let releaseId: number = parseInt(tl.getVariable('Release.ReleaseId'), 10);
    console.log(project);
    console.log(releaseId);
    let release: Release = await releaseApi.getRelease(project, releaseId);
    console.log(release.artifacts);




    // Read artifacts for latest release definition







    let packageChangelogMap: {[P:string]: string} = {};
    let latestReleaseDefinition: ChangelogRelease = {
      name: tl.getInput("releaseName", true),
      workItems: {},
      artifacts: []
    };


    for (let artifact of release.artifacts) {
      let artifacts_filepaths: ArtifactFilePaths[] = ArtifactFilePathFetcher.fetchArtifactFilePaths(
        artifact.alias,
        artifact.type
      );


      console.log('artifact filepaths', artifacts_filepaths);

      for (let artifactFilepaths of artifacts_filepaths) {
        let packageMetadata: PackageMetadata = JSON.parse(
          fs.readFileSync(artifactFilepaths.packageMetadataFilePath, 'utf8')
        );

        console.log(packageMetadata.package_name);
        console.log(packageMetadata.package_version_number);
        console.log(packageMetadata.sourceVersion);
        // TODO store the version number
        latestReleaseDefinition["artifacts"].push({
          name: packageMetadata["package_name"],
          from: undefined,
          to: packageMetadata["sourceVersion"]?.slice(0,8) || packageMetadata["sourceVersionTo"]?.slice(0,8),
          version: packageMetadata["package_version_number"],
          latestCommitId: undefined,
          commits: undefined
        });

        packageChangelogMap[packageMetadata["package_name"]] = path.join(
          path.dirname(artifactFilepaths.packageMetadataFilePath),
          `changelog.json`
        );
      }
    }

    console.log("Generating changelog...");

    // Check if any packages are missing changelog
    Object.values(packageChangelogMap).forEach( (changelogPath) => {
      if (!fs.existsSync(changelogPath)) {
        throw Error("Artifact is missing changelog. Check build task version compatability");
      }
    });

    // Get artifact versions from previous release definition
    let prevReleaseDefinition: ChangelogRelease;
    let releaseChangelog: ReleaseChangelog;
    if ( fs.existsSync(path.join(defaultRepoTempDir,`releasechangelog.json`)) ) {
      releaseChangelog = JSON.parse(fs.readFileSync(`releasechangelog.json`, 'utf8'));
      if (releaseChangelog["releases"].length > 0) {
        prevReleaseDefinition = releaseChangelog["releases"][releaseChangelog["releases"].length - 1];
      }
    }

    let prevReleaseLatestCommitId: {[P: string]: string} = {}
    if (prevReleaseDefinition) {
      for (let artifact of latestReleaseDefinition["artifacts"]) {
        for (let prevReleaseArtifact of prevReleaseDefinition["artifacts"]) {
          if (artifact["name"] === prevReleaseArtifact["name"]) {
            artifact["from"] = prevReleaseArtifact["to"];
            prevReleaseLatestCommitId[artifact["name"]] = prevReleaseArtifact["latestCommitId"];
            break;
          }
        }
      }
    }

    // Get commits for the latest release
    for (let artifact of latestReleaseDefinition["artifacts"]) {
      let packageChangelog: PackageChangelog = JSON.parse(fs.readFileSync(packageChangelogMap[artifact["name"]], 'utf8'));

      artifact["latestCommitId"] = packageChangelog["commits"][0]["commitId"];

      let fromIdx;
      if (artifact["from"]) {
        fromIdx = packageChangelog["commits"].findIndex( (commit) =>
          commit["commitId"] === prevReleaseLatestCommitId[artifact["name"]]
        );
        if (fromIdx === -1)
          throw Error(`Cannot find commit Id ${prevReleaseLatestCommitId[artifact["name"]]} in ${artifact["name"]} changelog`);
      }

      // Verify that latestReleaseDefinition changes
      // Always grab the latest commit
      if (fromIdx > 0) {
        artifact["commits"] = packageChangelog["commits"].slice(0, fromIdx+1);
      } else if (fromIdx === 0) {
        // Artifact verison has not changed
        artifact["commits"] = [];
        // Skip to next artifact
        continue;
      } else if (fromIdx === undefined ) {
        // Artifact was not in previous release
        artifact["commits"] = packageChangelog["commits"];
      }


      // Figure out work items for latest release
      let workItemFilter: RegExp = RegExp(tl.getInput("workItemFilter", true), 'gi');
      for (let commit of artifact["commits"]) {
        let workItems: RegExpMatchArray = commit["body"].match(workItemFilter) || commit["message"].match(workItemFilter);
        if (workItems) {
            for (let item of workItems) {
                if (latestReleaseDefinition["workItems"][item] == null) {
                    latestReleaseDefinition["workItems"][item] = new Set<string>();
                    latestReleaseDefinition["workItems"][item].add(commit["commitId"].slice(0,8));
                } else {
                    latestReleaseDefinition["workItems"][item].add(commit["commitId"].slice(0,8));
                }
            }
        }
      }
    }

    // Convert each work item Set to Array
    // Enables JSON stringification of work item
    for (let key in latestReleaseDefinition["workItems"]) {
      latestReleaseDefinition["workItems"][key] = Array.from(latestReleaseDefinition["workItems"][key]);
    }

    // Append results to release changelog
    if (releaseChangelog) {
      releaseChangelog["releases"].push(latestReleaseDefinition);
    } else {
      releaseChangelog = {
        releases: [latestReleaseDefinition]
      }
    }

    fs.writeFileSync(
      path.join(defaultRepoTempDir,`releasechangelog.json`),
      JSON.stringify(releaseChangelog, null, 4)
    );

    let payload: string = generateMarkdown(releaseChangelog, tl.getInput("workItemUrl", false), parseInt(tl.getInput("limit", false), 10));

    fs.writeFileSync(
      path.join(defaultRepoTempDir,`releasechangelog.md`),
      payload
    );


    git = simplegit(defaultRepoTempDir);
    await git.addConfig("user.name", "sfpowerscripts");
    await git.addConfig("user.email", "sfpowerscripts@dxscale");
    await git.add([`releasechangelog.json`, `releasechangelog.md`]);
    await git.commit(`[skip ci] updated changelog ${tl.getInput("releaseName", true)}`);
    await git.push();

  } catch (err) {
    tl.setResult(tl.TaskResult.Failed, err.message);

    // Cleanup temp directories
    for (let tempdir of tempDirectories) {
      tempdir.removeCallback();
    }
  } finally {
    for (let tempdir of tempDirectories) {
      tempdir.removeCallback();
    }

    tl.setResult(tl.TaskResult.Succeeded, 'Finished');
  }
}

function getVCSAuthDetails(version_control_provider: string): {token, username} {

  let token: string, username: string;

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
  return {token, username};
}

function buildAuthRemoteUrl(versionControlProvider: string, username: string, token: string, repositoryUrl: string) {
  let authRemoteUrl: string;

  const removeHttps = (url) => url.replace(/^https?:\/\//, "");

  if (versionControlProvider === "azureRepo") {
    authRemoteUrl = `https://x-token-auth:${token}@${removeHttps(repositoryUrl)}`;
  } else if (versionControlProvider == "bitbucket") {
    authRemoteUrl = `https://x-token-auth:${token}@${removeHttps(repositoryUrl)}`;
  } else if (
    versionControlProvider === "github" ||
    versionControlProvider === "githubEnterprise"
  ) {
    authRemoteUrl = `https://${token}:x-oauth-basic@${removeHttps(repositoryUrl)}`;
  } else if (versionControlProvider === "otherGit") {
    authRemoteUrl = `https://${username}:${token}@${removeHttps(repositoryUrl)}`;
  } else if (versionControlProvider === "hostedAgentGit") {
    authRemoteUrl = repositoryUrl;
  }

  return authRemoteUrl;
}

function generateMarkdown(releaseChangelog: ReleaseChangelog, workItemURL: string, limit: number): string {
  let payload: string = "";

  let limitReleases: number;
  if (limit <= releaseChangelog["releases"].length)
     limitReleases = releaseChangelog["releases"].length - limit;
  else
     limitReleases = 0;

  // Start from latest Release
  for (let releaseNum = releaseChangelog["releases"].length - 1 ; releaseNum >= limitReleases ; releaseNum-- ) {
      let release: Release = releaseChangelog["releases"][releaseNum];

      payload += `\n# ${release["name"]}\n`;

      payload += "## Artifacts\n";
      for (let artifactNum = 0 ; artifactNum < release["artifacts"].length ; artifactNum++) {
          payload += `**${release["artifacts"][artifactNum]["name"]}**     v${release["artifacts"][artifactNum]["version"]} (${release["artifacts"][artifactNum]["to"]})\n\n`;
      }

      payload += "## Work Items\n";
      for (let workItem in release["workItems"]) {
          let specificWorkItemURL: string;
          if (workItemURL != null) {
              if (workItemURL.endsWith('/')) {
                 specificWorkItemURL = workItemURL.concat(workItem);
              }
              else {
                 specificWorkItemURL = workItemURL.concat(`/${workItem}`);
              }
          }
          payload += `  - [${workItem}](${specificWorkItemURL})\n`
      }

      payload += "\n## Commits\n";
      for (let artifact of release["artifacts"]) {
          payload += `\n### ${artifact["name"]}\n`;
          if (artifact["commits"].length > 0) {
              for (let commit of artifact["commits"]) {
                  let commitDate: Date = new Date(commit.date);
                  payload += `  - ${getDate(commitDate)}, ${getTime(commitDate)}      ${commit.commitId}      ${commit.message}\n`;
              }
          } else if (artifact["from"] === artifact["to"]) {
              payload += `  - Artifact version has not changed\n`
          } else {
              payload += ` - No changes to ${artifact["name"]} package directory detected. Artifact version may have been updated due to:\n`;
              payload += `    - Modified scratch org definition file\n`;
              payload += `    - Incremented package version in sfdx-project.json\n`;
              payload += `    - Build all packages\n`
          }
      }
  }
  return payload;
}

function getDate(date: Date): string {
  let day: number = date.getDate();
  let month: number = date.getMonth();
  let year: number = date.getFullYear();
  let pad = (n) => n<10 ? '0'+n : n;

  return pad(day) + "/" + pad(month+1) + "/" + year;
}

function getTime(date: Date): string {
  let hours: number = date.getHours();
  let minutes: number = date.getMinutes();
  let seconds: number = date.getSeconds();
  let pad = (n) => n<10 ? '0'+n : n;

  return pad(hours) + ":" + pad(minutes) + ":" + pad(seconds);
}

run();
