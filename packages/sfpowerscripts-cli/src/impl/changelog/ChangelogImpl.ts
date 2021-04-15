import simplegit, { SimpleGit } from "simple-git/promise";
import ArtifactFilePathFetcher, { ArtifactFilePaths } from "@dxatscale/sfpowerscripts.core/lib/artifacts/ArtifactFilePathFetcher";
import PackageMetadata from "@dxatscale/sfpowerscripts.core/lib/PackageMetadata";
import { ReleaseChangelog, Release, Artifact } from "@dxatscale/sfpowerscripts.core/lib/changelog/interfaces/ReleaseChangelogInterfaces";
import { Changelog as PackageChangelog } from "@dxatscale/sfpowerscripts.core/lib/changelog/interfaces/GenericChangelogInterfaces";
import generateMarkdown from "@dxatscale/sfpowerscripts.core/lib/changelog/GenerateChangelogMarkdown";
import * as fs from "fs-extra"
import path = require('path');
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

      let releaseChangelog: ReleaseChangelog;
      if (fs.existsSync(path.join(repoTempDir,`releasechangelog.json`))) {
        releaseChangelog = JSON.parse(fs.readFileSync(path.join(repoTempDir,`releasechangelog.json`), 'utf8'));
      }

      let isRetriedRelease = this.releaseName === releaseChangelog?.releases[releaseChangelog.releases.length - 1].name;
      if (isRetriedRelease) {
        console.log("Skipping changelog generation for retried release...");
        return;
      }


      let artifactsToPackageMetadata: {[p: string]: PackageMetadata} = {};
      let packagesToChangelogFilePaths: {[p:string]: string} = {};
      for (let artifactFilepaths of artifact_filepaths) {
        let packageMetadata: PackageMetadata = JSON.parse(
          fs.readFileSync(artifactFilepaths.packageMetadataFilePath, 'utf8')
        );

        artifactsToPackageMetadata[packageMetadata.package_name] = packageMetadata;
        packagesToChangelogFilePaths[packageMetadata.package_name] = artifactFilepaths.changelogFilePath;
      }

      console.log("Generating changelog...");

      let latestRelease: Release = this.initLatestRelease(this.releaseName, artifactsToPackageMetadata);

      let artifactsToLatestCommitId: {[P: string]: string};
      if (releaseChangelog?.releases.length > 0) {
        artifactsToLatestCommitId = this.getArtifactsToLatestCommitId(
          releaseChangelog,
          latestRelease
        );
      };

      this.generateCommits(latestRelease, packagesToChangelogFilePaths, artifactsToLatestCommitId);

      this.generateWorkItems(latestRelease, this.workItemFilter);

      // Convert each work item Set to Array
      // Enables JSON stringification of work item
      for (let key in latestRelease["workItems"]) {
        latestRelease.workItems[key] = Array.from(latestRelease.workItems[key]);
      }

      if (releaseChangelog) {
        // Append results to release changelog
        releaseChangelog["releases"].push(latestRelease);
      } else {
        releaseChangelog = {
          releases: [latestRelease]
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
   * Generate work items in latest release
   * @param latestRelease
   * @param workItemPattern
   */
  private generateWorkItems(latestRelease: Release, workItemPattern: string) {
    // Compute work items for latest release
    let workItemFilter: RegExp = RegExp(workItemPattern, 'gi');

    for (let artifact of latestRelease["artifacts"]) {
      for (let commit of artifact["commits"]) {
        let commitMessage: String = commit["message"] + "\n" + commit["body"];
        let workItems: RegExpMatchArray = commitMessage.match(workItemFilter);
        if (workItems) {
            for (let item of workItems) {
                if (latestRelease["workItems"][item] == null) {
                    latestRelease["workItems"][item] = new Set<string>();
                    latestRelease["workItems"][item].add(commit["commitId"].slice(0,8));
                } else {
                    latestRelease["workItems"][item].add(commit["commitId"].slice(0,8));
                }
            }
        }
      }
    }
  }

  /**
   * Generate commits in latest release, for each artifact
   * Also sets new latestCommitId for artifacts
   * @param latestRelease
   * @param packagesToChangelogFilePaths
   * @param artifactsToLatestCommitId
   */
  private generateCommits(
    latestRelease: Release,
    packagesToChangelogFilePaths: {[p:string]: string},
    artifactsToLatestCommitId: {[p:string]: string}
  ): void {
    for (let artifact of latestRelease["artifacts"]) {
      let packageChangelog: PackageChangelog = JSON.parse(
        fs.readFileSync(packagesToChangelogFilePaths[artifact.name], 'utf8')
      );

      let indexOfLatestCommitId;
      if (artifactsToLatestCommitId?.[artifact.name]) {
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

      // Set new latestCommitId
      artifact["latestCommitId"] = packageChangelog["commits"][0]["commitId"];
    }
  }

  /**
   * Initalise latest release
   * @param releaseName
   * @param artifactsToPackageMetadata
   * @returns
   */
  private initLatestRelease(
    releaseName: string,
    artifactsToPackageMetadata: { [p: string]: PackageMetadata; }
  ): Release {
    let latestRelease: Release = {
      name: releaseName,
      workItems: {},
      artifacts: []
    };

    for (let packageMetadata of Object.values(artifactsToPackageMetadata)) {
      let artifact: Artifact = {
        name: packageMetadata["package_name"],
        from: undefined,
        to: packageMetadata["sourceVersion"]?.slice(0, 8) || packageMetadata["sourceVersionTo"]?.slice(0, 8),
        version: packageMetadata["package_version_number"],
        latestCommitId: undefined,
        commits: undefined
      };

      latestRelease["artifacts"].push(artifact);
    }

    return latestRelease;
  }

  /**
   * Get map of artifacts to the latest commit Id in past releases
   * Also sets artifact "from" property
   * @param releaseChangelog
   * @param latestRelease
   * @returns
   */
  private getArtifactsToLatestCommitId(releaseChangelog: ReleaseChangelog, latestRelease: Release) {
    let artifactsToLatestCommitId: { [P: string]: string; } = {};

    for (let latestReleaseArtifact of latestRelease.artifacts) {

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
