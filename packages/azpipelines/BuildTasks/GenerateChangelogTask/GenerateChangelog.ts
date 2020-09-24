import tl = require("azure-pipelines-task-lib/task");
import ArtifactFilePathFetcher, { ArtifactFilePaths } from "@dxatscale/sfpowerscripts.core/lib/artifacts/ArtifactFilePathFetcher";
import PackageMetadata from "@dxatscale/sfpowerscripts.core/lib/PackageMetadata";
import generateMarkdown from "@dxatscale/sfpowerscripts.core/lib/changelog/GenerateChangelogMarkdown";
import { ReleaseChangelog, Release, Artifact } from "@dxatscale/sfpowerscripts.core/lib/changelog/interfaces/ReleaseChangelogInterfaces";
import { Changelog as PackageChangelog } from "@dxatscale/sfpowerscripts.core/lib/changelog/interfaces/GenericChangelogInterfaces";
import authVCS from "../Common/VersionControlAuth";
import simplegit, { SimpleGit } from "simple-git/promise";
import ArtifactHelper from "../Common/ArtifactHelper";

import fs = require("fs");
const tmp = require('tmp');
const path = require("path");

async function run() {
  let tempDir = tmp.dirSync({unsafeCleanup: true});
  try {
    const taskType: string = tl.getVariable("Release.ReleaseId") ? "Release" : "Build";
    const artifactDir = tl.getInput("aritfactDir",false);
    const repositoryUrl: string = tl.getInput("repositoryUrl", true);
    const branch: string = tl.getInput("branchName", true);

    console.log(`Cloning repository ${repositoryUrl}`);

    let remote: string = authVCS(repositoryUrl);
    let git: SimpleGit = simplegit();

    await git.clone(
      remote,
      tempDir.name
    );
    const repoTempDir = tempDir.name;

    console.log(`Checking out branch ${branch}`);
    git = simplegit(repoTempDir);
    await git.checkout(branch);


    let packageChangelogMap: {[P:string]: string} = {};
    let latestReleaseDefinition: Release = {
      name: tl.getInput("releaseName", true),
      workItems: {},
      artifacts: []
    };



    if (taskType === "Release") {
      // Use artifact type from Release API
      console.log(
        `Fetching artifacts from artifact directory ${tl.getVariable("system.artifactsDirectory")}`
      );
    } else {
      // Default to Pipeline artifact type for Build task type
      console.log(
        `Build pipeline detected.`,
        `Fetching artifacts from pipeline workspace ${tl.getVariable("pipeline.workspace")}`
      );
    }


    let artifacts_filepaths: ArtifactFilePaths[] = ArtifactFilePathFetcher.fetchArtifactFilePaths(
      ArtifactHelper.getArtifactDirectory(artifactDir)
    );

    if (artifacts_filepaths.length === 0) {
      throw new Error(`No artifacts found at ${ArtifactHelper.getArtifactDirectory(artifactDir)}`);
    }

    let missingChangelogs: Error[] = [];
    for (let artifactFilepaths of artifacts_filepaths) {
      let packageMetadata: PackageMetadata = JSON.parse(
        fs.readFileSync(artifactFilepaths.packageMetadataFilePath, 'utf8')
      );

      let artifact: Artifact = {
        name: packageMetadata["package_name"],
        from: undefined,
        to: packageMetadata["sourceVersion"]?.slice(0,8) || packageMetadata["sourceVersionTo"]?.slice(0,8),
        version: packageMetadata["package_version_number"],
        latestCommitId: undefined,
        commits: undefined
      }

      latestReleaseDefinition["artifacts"].push(artifact);

      if (!fs.existsSync(artifactFilepaths.changelogFilePath)) {
        missingChangelogs.push(
          new Error(`No changelog found in artifact ${packageMetadata["package_name"]} ${packageMetadata["package_version_number"]}`)
        );
      }

      packageChangelogMap[packageMetadata["package_name"]] = artifactFilepaths.changelogFilePath;
    }

    if (missingChangelogs.length > 0) {
      throw missingChangelogs;
    }

    console.log("Generating changelog...");

    // Get artifact versions from previous release definition
    let releaseChangelog: ReleaseChangelog;
    let prevReleaseDefinition: Release;
    if ( fs.existsSync(path.join(repoTempDir,`releasechangelog.json`)) ) {
      releaseChangelog = JSON.parse(fs.readFileSync(path.join(repoTempDir,`releasechangelog.json`), 'utf8'));
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
      let packageChangelog: PackageChangelog = JSON.parse(
        fs.readFileSync(packageChangelogMap[artifact["name"]], 'utf8')
      );

      artifact["latestCommitId"] = packageChangelog["commits"][0]["commitId"];

      let fromIdx;
      if (artifact["from"]) {
        fromIdx = packageChangelog["commits"].findIndex( (commit) =>
          commit["commitId"] === prevReleaseLatestCommitId[artifact["name"]]
        );
        if (fromIdx === -1)
          throw new Error(`Cannot find commit Id ${prevReleaseLatestCommitId[artifact["name"]]} in ${artifact["name"]} changelog`);
      }

      if (fromIdx > 0) {
        artifact["commits"] = packageChangelog["commits"].slice(0, fromIdx);
      } else if (fromIdx === 0) {
        // Artifact verison has not changed
        artifact["commits"] = [];
        // Skip to next artifact
        continue;
      } else if (fromIdx === undefined ) {
        // Artifact was not in previous release
        artifact["commits"] = packageChangelog["commits"];
      }


      // Compute work items for latest release
      let workItemFilter: RegExp = RegExp(tl.getInput("workItemFilter", true), 'gi');
      for (let commit of artifact["commits"]) {
        let commitMessage: String = commit["message"] + "\n" + commit["body"];
        let workItems: RegExpMatchArray = commitMessage.match(workItemFilter);
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
      path.join(repoTempDir,`releasechangelog.json`),
      JSON.stringify(releaseChangelog, null, 4)
    );

    let payload: string = generateMarkdown(
      releaseChangelog,
      tl.getInput("workItemUrl", false),
      parseInt(tl.getInput("limit", false), 10)
    );

    fs.writeFileSync(
      path.join(repoTempDir,`Release-Changelog.md`),
      payload
    );

    console.log(`Pushing changelog files`, repositoryUrl, branch);
    git = simplegit(repoTempDir);
    await git.addConfig("user.name", "sfpowerscripts");
    await git.addConfig("user.email", "sfpowerscripts@dxscale");
    await git.add([`releasechangelog.json`, `releasechangelog.md`]);
    await git.commit(`[skip ci] Updated Changelog ${tl.getInput("releaseName", true)}`);

    if (tl.getInput("forcePush", false)) {
      await git.push(`--force`);
    } else {
      await git.push();
    }

  } catch (err) {
    // Cleanup temp directories
    tempDir.removeCallback();

    let errorMessage: string = "";
    if (err instanceof Array) {
      for (let e of err) {
        errorMessage += e.message + `\n`;
      }
    } else {
      errorMessage = err.message;
    }
    tl.setResult(tl.TaskResult.Failed, errorMessage);
  } finally {
    tempDir.removeCallback();
    tl.setResult(tl.TaskResult.Succeeded, 'Finished');
  }
}

run();
