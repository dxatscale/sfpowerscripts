import tl = require("azure-pipelines-task-lib/task");
import child_process = require("child_process");
import { onExit } from "@dxatscale/sfpowerscripts.core/lib/utils/OnExit";
import { getWebAPIWithoutToken } from "../Common/WebAPIHelper";
import { IReleaseApi } from "azure-devops-node-api/ReleaseApi";
import { Release, Artifact } from "azure-devops-node-api/interfaces/ReleaseInterfaces";
import ArtifactFilePathFetcher, { ArtifactFilePaths } from "../Common/ArtifactFilePathFetcher";
import GenerateChangelogImpl, { Changelog } from "@dxatscale/sfpowerscripts.core/lib/changelog/GenerateChangelogImpl";
import simplegit, { SimpleGit } from "simple-git/promise";
const tmp = require('tmp');
import fs = require("fs");
import { version } from "process";
const path = require("path");

async function run() {
  const tempDirectories = [];
  try {
    let git: SimpleGit = simplegit();

    const versionControlProvider: string = tl.getInput("versionControlProvider", true);
    let vcsAuthDetails = getVCSAuthDetails(versionControlProvider);
    let token: string = vcsAuthDetails.token;
    let username: string = vcsAuthDetails.username;

    let remoteCreds: string;

    if (versionControlProvider == "azureRepo") {
        remoteCreds = `https://x-token-auth:${token}@`;
    } else if (versionControlProvider == "bitbucket") {
        remoteCreds = `https://x-token-auth:${token}@`;
    } else if (
        versionControlProvider == "github" ||
        versionControlProvider == "githubEnterprise"
    ) {
        remoteCreds = `https://${token}:x-oauth-basic@`;
    } else if (versionControlProvider == "otherGit") {
        remoteCreds = `https://${username}:${token}@`;
    }


    // Clone git repositories
    const pkgTempDirMap: {[P: string]: string} = {};

    let tempDir: any = tmp.dirSync({unsafeCleanup: true});
    let defaultRemote: string;
    if (versionControlProvider === "hostedAgentGit") {
      defaultRemote = tl.getInput("defaultRepository", true);
    } else {
      defaultRemote = `${remoteCreds}${parseRepoUrl(tl.getInput("defaultRepository", true))}`;
    }

    await git.clone(
      defaultRemote,
      tempDir.name
    );
    const defaultRepoTempDir = tempDir.name;

    tempDirectories.push(tempDir); // Store temp directories for deletion when process exits

    // Get manifest
    const branch: string = tl.getInput("branch", true);
    git = simplegit(defaultRepoTempDir);
    await git.checkoutLocalBranch(branch);

    const manifestFilepath: string = path.join(
      defaultRepoTempDir,
      tl.getInput("manifestFilepath", true)
    );

    const manifest = JSON.parse(fs.readFileSync(manifestFilepath, 'utf8'));
    // TODO: Validate manifest

    if (manifest["repositories"] != null) {
      for (let repository of manifest["repositories"]) {
          tempDir = tmp.dirSync({unsafeCleanup: true});

          let remote: string;
          if (versionControlProvider === "hostedAgentGit") {
            remote = repository["url"];
          } else {
            remote = `${remoteCreds}${parseRepoUrl(repository["url"])}`;
          }
          await git.clone(
            remote,
            tempDir.name
          );

          // Map packages to temp directory
          for (let pkg of repository["packages"]) {
              pkgTempDirMap[pkg] = tempDir.name;
          }

          tempDirectories.push(tempDir);
      }
    }


    //WebAPI Initialization
    const webApi = await getWebAPIWithoutToken();
    const releaseApi: IReleaseApi = await webApi.getReleaseApi();

    let project: string = tl.getVariable('System.TeamProject');
    let releaseId: number = parseInt(tl.getVariable('Release.ReleaseId'), 10);
    console.log(project);
    console.log(releaseId);
    let release: Release = await releaseApi.getRelease(project, releaseId);
    console.log(release.artifacts);

    let releaseName: string = tl.getVariable('Release.ReleaseName');
    if (manifest["releases"] == null) {
      manifest["releases"] = [{
        name: releaseName,
        artifacts: []
      }];
    } else {
      manifest["releases"].push({
        name: releaseName,
        artifacts: []
      })
    }
    const releaseNum: number = manifest["releases"].length - 1;

    for (let artifact of release.artifacts) {
      let artifacts_filepaths: ArtifactFilePaths[] = ArtifactFilePathFetcher.fetchArtifactFilePaths(
        artifact.alias,
        artifact.type
      );

      console.log('artifact filepaths', artifacts_filepaths);
      // Parse artifact metadata json to retrieve version number & commit Id

      for (let artifactFilepaths of artifacts_filepaths) {
        let artifactMetadata = JSON.parse(
          fs.readFileSync(artifactFilepaths.packageMetadataFilePath, 'utf8')
        );

        console.log(artifactMetadata.package_name);
        console.log(artifactMetadata.package_version_number);
        console.log(artifactMetadata.sourceVersion);

        manifest["releases"][releaseNum]["artifacts"].push({
          name: artifactMetadata.package_name,
          version: artifactMetadata.sourceVersion
        });
      }
    }

    const releaseHistory: ReleaseHistory = {
      releases: []
    };

    const workItemFilter: string = manifest["workItemFilter"];
    const workItemURL: string = manifest["workItemURL"];
    const releaseTags: string[][] = [];

    console.log(`Generating release history, as per manifest ${this.flags.manifest}`);
    // Generate changelog between releases defined in manifest
    for (let releaseNum = 0 ; releaseNum < manifest["releases"].length ; releaseNum++ ) {

        // Initalise release object
        let nextRelease: release = {
            "name": manifest["releases"][releaseNum]["name"],
            "workItems": {},
            "artifacts": []
        }

        let tags: string[] = [];

        for (let artifact of manifest["releases"][releaseNum]["artifacts"]) {

            // Set project directory to artifact's repo
            let project_directory: string;
            if (pkgTempDirMap[artifact["name"]] != null) {
                project_directory = pkgTempDirMap[artifact["name"]];
            } else {
                project_directory = defaultRepoTempDir;
            }

            git = simplegit(project_directory);

            let artifactFromVersion: string;
            if (releaseNum > 0) {
                // Get artifact version from previous release
                for (let prevReleaseArtifact of manifest["releases"][releaseNum-1]["artifacts"]) {
                    if (prevReleaseArtifact["name"] === artifact["name"]) {
                        artifactFromVersion = prevReleaseArtifact["version"];
                        break;
                    }
                }
            }

            // Dereference the tag to get the commit that it points at
            let revFrom: string;
            if (artifactFromVersion != null) {
                revFrom = await git.revparse([
                    "--short",
                    `${artifactFromVersion}^{}`
                ]);
            }

            let revTo: string;
            try {
                revTo = await git.revparse([
                    "--short",
                    `${artifact["version"]}^{}`
                ]);
            } catch(revisionError) {
                console.log(`Unable to find revision ${artifact["version"]}`);
                throw(revisionError);
            }

            tags.push(artifact["version"]);


            // Generate changelog for single artifact between two release versions
            let generateChangelogImpl: GenerateChangelogImpl = new GenerateChangelogImpl(
                artifact["name"],
                revFrom,
                revTo,
                workItemFilter,
                project_directory
            );

            let result: Changelog = await generateChangelogImpl.exec();

            // Add work items to the release
            // Work items and their commits are deduped
            for (let item in result["workItems"]) {
                if (nextRelease["workItems"][item] == null) {
                    nextRelease["workItems"][item] = result["workItems"][item];
                } else {
                    for (let commit of result["workItems"][item]) {
                        nextRelease["workItems"][item].add(commit);
                    }
                }
            }

            nextRelease["artifacts"].push(result["package"]);
        }

        releaseTags.push(tags); // Store the tag names in each release, for markdown generation

        // Convert each work item Set to Array
        // Enables JSON stringification of work item
        for (let key in nextRelease["workItems"]) {
            nextRelease["workItems"][key] = Array.from(nextRelease["workItems"][key]);
        }

        releaseHistory["releases"].push(nextRelease);
    }

    fs.writeFileSync(
      path.join(defaultRepoTempDir, `releasechangelog.json`),
      JSON.stringify(releaseHistory, null, 4)
    );

    generateMarkdown(releaseHistory, workItemURL, null, releaseTags, defaultRepoTempDir);

    let updatedManifest: string = JSON.stringify(manifest, null, 4);
    fs.writeFileSync(manifestFilepath, updatedManifest);

    git = simplegit(defaultRepoTempDir);
    await git.addConfig("user.name", "sfpowerscripts");
    await git.addConfig("user.email", "sfpowerscripts@dxscale");
    await git.add([`releasechangelog.json`, `releasechangelog.md`, tl.getInput("manifestFilepath", true)]);
    await git.commit(`[skip ci] updated changelog`);
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

function parseRepoUrl(repoUrl: string): string{
  // let versionControlProvider: string = tl.getInput("versionControlProvider", true);
  // if (versionControlProvider == "azureRepo") {
  //   //Fix Issue https://developercommunity.visualstudio.com/content/problem/411770/devops-git-url.html
  //   repoUrl = repoUrl.substring(
  //     repoUrl.indexOf("@") + 1
  //   );
  // } else {
    repoUrl = repoUrl.replace(/^https?:\/\//, "");
  // }
  return repoUrl;
}

function generateMarkdown(releaseHistory: ReleaseHistory, workItemURL: string, limit: number, releaseTags: string[][], defaultRepoDir: string): void {
  let payload: string = "";

  let limitReleases: number;
  if (limit != null)
     limitReleases = releaseHistory["releases"].length - limit;
  else
     limitReleases = 0;

  // Start from latest Release
  for (let releaseNum = releaseHistory["releases"].length - 1 ; releaseNum >= limitReleases ; releaseNum-- ) {
      let release = releaseHistory["releases"][releaseNum];

      payload += `\n# ${release["name"]}\n`;

      payload += "## Artifacts\n";
      for (let artifactNum = 0 ; artifactNum < release["artifacts"].length ; artifactNum++) {
          payload += `**${release["artifacts"][artifactNum]["name"]}**     ${releaseTags[releaseNum][artifactNum]} (${release["artifacts"][artifactNum]["to"]})\n\n`;
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
  fs.writeFileSync(
    path.join(defaultRepoDir, `releasechangelog.md`),
    payload
  );
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

interface ReleaseHistory {
  releases: release[]
}

type release = {
  name: string,
  workItems: any
  artifacts: artifact[]
}

type artifact = {
  name: string,
  from: string,
  to: string,
  commits: commit[]
}

type commit = {
  commitId: string,
  date: string,
  elapsedDays: string,
  author: string,
  message: string,
  body: string
}

run();
