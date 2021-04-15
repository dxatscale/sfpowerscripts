import simplegit, { SimpleGit } from "simple-git/promise";
import ArtifactFilePathFetcher, { ArtifactFilePaths } from "@dxatscale/sfpowerscripts.core/lib/artifacts/ArtifactFilePathFetcher";
import PackageMetadata from "@dxatscale/sfpowerscripts.core/lib/PackageMetadata";
import { ReleaseChangelog, Release, Artifact } from "@dxatscale/sfpowerscripts.core/lib/changelog/interfaces/ReleaseChangelogInterfaces";
import { Changelog as PackageChangelog } from "@dxatscale/sfpowerscripts.core/lib/changelog/interfaces/GenericChangelogInterfaces";
import generateMarkdown from "@dxatscale/sfpowerscripts.core/lib/changelog/GenerateChangelogMarkdown";
import * as fs from "fs-extra"
import path = require('path');
import { string } from "@oclif/command/lib/flags";
const tmp = require('tmp');

export default class ChangelogImpl {

  constructor(
    private artifactDir: string,
    private releaseName: string,
    private workItemFilter: string,
    private repoUrl: string,
    private branchName: string,
    private limit: number,
    private workItemUrl: string,
    private showAllArtifacts: boolean,
    private forcePush: boolean
  ){}

  async exec() {

    let tempDir = tmp.dirSync({unsafeCleanup: true});

    try {
      let git: SimpleGit = simplegit();

      console.log(`Cloning repository ${this.repoUrl}`);
      await git.clone(
        this.repoUrl,
        tempDir.name
      );
      const repoTempDir = tempDir.name;

      console.log(`Checking out branch ${this.branchName}`);
      git = simplegit(repoTempDir);
      await git.checkout(this.branchName);

      let artifact_filepaths: ArtifactFilePaths[] = ArtifactFilePathFetcher.fetchArtifactFilePaths(
        this.artifactDir
      );

      if (artifact_filepaths.length === 0) {
        throw new Error(`No artifacts found at ${path.resolve(process.cwd(), this.artifactDir)}`);
      }

      let prevReleaseDefinition: Release;
      let releaseChangelog: ReleaseChangelog;
      if (fs.existsSync(path.join(repoTempDir,`releasechangelog.json`))) {
        releaseChangelog = JSON.parse(fs.readFileSync(path.join(repoTempDir,`releasechangelog.json`), 'utf8'));
        if (releaseChangelog["releases"].length > 0) {
          prevReleaseDefinition = releaseChangelog["releases"][releaseChangelog["releases"].length - 1];
        }
      }

      if (prevReleaseDefinition?.name === this.releaseName) {
        console.log(`The release named "${this.releaseName}" already exists.`);
        console.log("Skipping changelog generation...");
        return;
      }

      let packageChangelogMap: {[P:string]: string} = {};
      let latestReleaseDefinition: Release = {
        name: this.releaseName,
        workItems: {},
        artifacts: []
      };

      // Read artifacts for latest release definition
      let missingChangelogs: Error[] = [];
      for (let artifactFilepaths of artifact_filepaths ) {

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

      let artifactsToLatestCommitId: {[P: string]: string};
      if (releaseChangelog.releases.length > 0) {
        artifactsToLatestCommitId = this.getArtifactsToLatestCommitId(
          releaseChangelog,
          latestReleaseDefinition
        );
      };

      // Get commits for the latest release
      for (let artifact of latestReleaseDefinition["artifacts"]) {
        let packageChangelog: PackageChangelog = JSON.parse(
          fs.readFileSync(packageChangelogMap[artifact["name"]], 'utf8')
        );

        // Set new latestCommitId
        artifact["latestCommitId"] = packageChangelog["commits"][0]["commitId"];

        let indexOfLatestCommitId;
        if (artifactsToLatestCommitId[artifact.name]) {
          indexOfLatestCommitId = packageChangelog["commits"].findIndex( (commit) =>
            commit["commitId"] === artifactsToLatestCommitId[artifact.name]
          );
          if (indexOfLatestCommitId === -1) {
            console.log(`Cannot find commit Id ${artifactsToLatestCommitId[artifact.name]} in ${artifact.name} changelog`);
            console.log("Assuming that there are no changes...");
            artifact["commits"] = [];
            continue;
          }
        }


        if (indexOfLatestCommitId > 0) {
          artifact["commits"] = packageChangelog["commits"].slice(0, indexOfLatestCommitId);
        } else if (indexOfLatestCommitId === 0) {
          // Artifact verison has not changed
          artifact["commits"] = [];
          // Skip to next artifact
          continue;
        } else if (indexOfLatestCommitId === undefined ) {
          // Artifact was not in previous release
          artifact["commits"] = packageChangelog["commits"];
        }


        // Compute work items for latest release
        let workItemFilter: RegExp = RegExp(this.workItemFilter, 'gi');
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
        this.workItemUrl,
        this.limit,
        this.showAllArtifacts
      );

      fs.writeFileSync(
        path.join(repoTempDir,`Release-Changelog.md`),
        payload
      );

      console.log("Pushing changelog files to", this.repoUrl, this.branchName);
      git = simplegit(repoTempDir);
      await git.addConfig("user.name", "sfpowerscripts");
      await git.addConfig("user.email", "sfpowerscripts@dxscale");
      await git.add([`releasechangelog.json`, `Release-Changelog.md`]);
      await git.commit(`[skip ci] Updated Changelog ${this.releaseName}`);

      if (this.forcePush) {
        await git.push(`--force`);
      } else {
        await git.push();
      }

      console.log(`Successfully generated changelog`);
    } finally {
      tempDir.removeCallback();
    }
  }

  /**
   * Get map of artifacts to the latest commit Id in past releases
   * @param releaseChangelog
   * @param latestReleaseDefinition
   * @returns
   */
  private getArtifactsToLatestCommitId(releaseChangelog: ReleaseChangelog, latestReleaseDefinition: Release) {
    let artifactsToLatestCommitId: { [P: string]: string; } = {};

    for (let latestReleaseArtifact of latestReleaseDefinition.artifacts) {

      loopThroughReleases: for (let release of releaseChangelog.releases) {
        for (let artifact of release.artifacts) {
          if (artifact.name === latestReleaseArtifact.name) {
            latestReleaseArtifact.from = artifact.to;
            artifactsToLatestCommitId[latestReleaseArtifact.name] = artifact.latestCommitId;
            break loopThroughReleases;
          }
        }
      }

    }

    return artifactsToLatestCommitId;
  }
}
