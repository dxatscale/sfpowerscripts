import tl = require("azure-pipelines-task-lib/task");
import { getWebAPIWithoutToken } from "../Common/WebAPIHelper";
import { IReleaseApi } from "azure-devops-node-api/ReleaseApi";
import { Release } from "azure-devops-node-api/interfaces/ReleaseInterfaces";
import ArtifactFilePathFetcher, { ArtifactFilePaths } from "../Common/ArtifactFilePathFetcher";
import PackageMetadata from "@dxatscale/sfpowerscripts.core/lib/PackageMetadata";
import generateMarkdown from "@dxatscale/sfpowerscripts.core/lib/changelog/GenerateChangelogMarkdown";
import { ReleaseChangelog, Release as ChangelogRelease} from "@dxatscale/sfpowerscripts.core/lib/changelog/interfaces/ReleaseChangelogInterfaces";
import { Changelog as PackageChangelog } from "@dxatscale/sfpowerscripts.core/lib/changelog/interfaces/GenericChangelogInterfaces";
import authVCS from "../Common/VersionControlAuth";
import simplegit, { SimpleGit } from "simple-git/promise";
import fs = require("fs");
const tmp = require('tmp');
const path = require("path");

async function run() {
  let tempDir = tmp.dirSync({unsafeCleanup: true});
  try {
    let taskType: string = tl.getVariable("Release.ReleaseId") ? "Release" : "Build";

    if (taskType === "Build") {
      throw Error("Generate Changelog task can only be used on a release pipeline");
    }

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



    // Get latest release definition using Azure Release API
    const webApi = await getWebAPIWithoutToken();
    const releaseApi: IReleaseApi = await webApi.getReleaseApi();

    let project: string = tl.getVariable('System.TeamProject');
    let releaseId: number = parseInt(tl.getVariable('Release.ReleaseId'), 10);
    let release: Release = await releaseApi.getRelease(project, releaseId);


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


      for (let artifactFilepaths of artifacts_filepaths) {
        let packageMetadata: PackageMetadata = JSON.parse(
          fs.readFileSync(artifactFilepaths.packageMetadataFilePath, 'utf8')
        );

        latestReleaseDefinition["artifacts"].push({
          name: packageMetadata["package_name"],
          from: undefined,
          to: packageMetadata["sourceVersion"]?.slice(0,8) || packageMetadata["sourceVersionTo"]?.slice(0,8),
          version: packageMetadata["package_version_number"],
          latestCommitId: undefined,
          commits: undefined
        });

        packageChangelogMap[packageMetadata["package_name"]] = artifactFilepaths.changelogFilePath;
      }
    }

    console.log("Generating changelog...");

    // Check if any packages are missing changelog
    Object.keys(packageChangelogMap).forEach( (pkg) => {
      if (!fs.existsSync(packageChangelogMap[pkg])) {
        throw Error("Artifact is missing changelog. Check build task version compatability");
      }
    });

    // Get artifact versions from previous release definition
    let releaseChangelog: ReleaseChangelog;
    let prevReleaseDefinition: ChangelogRelease;
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
          throw Error(`Cannot find commit Id ${prevReleaseLatestCommitId[artifact["name"]]} in ${artifact["name"]} changelog`);
      }

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


      // Compute work items for latest release
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
      path.join(repoTempDir,`releasechangelog.json`),
      JSON.stringify(releaseChangelog, null, 4)
    );

    let payload: string = generateMarkdown(
      releaseChangelog,
      tl.getInput("workItemUrl", false),
      parseInt(tl.getInput("limit", false), 10)
    );

    fs.writeFileSync(
      path.join(repoTempDir,`releasechangelog.md`),
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
    tl.setResult(tl.TaskResult.Failed, err.message);
  } finally {
    tempDir.removeCallback();
    tl.setResult(tl.TaskResult.Succeeded, 'Finished');
  }
}

run();
