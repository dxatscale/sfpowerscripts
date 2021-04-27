import simplegit, { SimpleGit } from "simple-git/promise";
import ArtifactFilePathFetcher, { ArtifactFilePaths } from "@dxatscale/sfpowerscripts.core/lib/artifacts/ArtifactFilePathFetcher";
import PackageMetadata from "@dxatscale/sfpowerscripts.core/lib/PackageMetadata";
import { ReleaseChangelog, Release, ReleaseId, Artifact } from "@dxatscale/sfpowerscripts.core/lib/changelog/interfaces/ReleaseChangelogInterfaces";
import { Changelog as PackageChangelog } from "@dxatscale/sfpowerscripts.core/lib/changelog/interfaces/GenericChangelogInterfaces";
import generateMarkdown from "@dxatscale/sfpowerscripts.core/lib/changelog/GenerateChangelogMarkdown";
import * as fs from "fs-extra"
import path = require('path');
const tmp = require('tmp');
var marked = require('marked');
var TerminalRenderer = require('marked-terminal');
var hash = require('object-hash');
import lodash = require("lodash");


marked.setOptions({
  // Define custom renderer
  renderer: new TerminalRenderer()
});

export default class ChangelogImpl {

  constructor(
    private artifactDir: string,
    private releaseName: string,
    private workItemFilter: string,
    private repoUrl: string,
    private limit: number,
    private workItemUrl: string,
    private showAllArtifacts: boolean,
    private forcePush: boolean,
    private org?: string
  ){
    this.org = org?.toLowerCase();
  }

  async exec() {
    let tempDir = tmp.dirSync({unsafeCleanup: true});

    try {
      let artifact_filepaths: ArtifactFilePaths[] = ArtifactFilePathFetcher.fetchArtifactFilePaths(
        this.artifactDir
      );

      if (artifact_filepaths.length === 0) {
        throw new Error(`No artifacts found at ${path.resolve(process.cwd(), this.artifactDir)}`);
      }

      let artifactsToPackageMetadata: {[p: string]: PackageMetadata} = {};
      let packagesToChangelogFilePaths: {[p:string]: string} = {};
      let artifactSourceBranch: string;
      for (let artifactFilepaths of artifact_filepaths) {
        let packageMetadata: PackageMetadata = JSON.parse(
          fs.readFileSync(artifactFilepaths.packageMetadataFilePath, 'utf8')
        );

        artifactsToPackageMetadata[packageMetadata.package_name] = packageMetadata;
        packagesToChangelogFilePaths[packageMetadata.package_name] = artifactFilepaths.changelogFilePath;

        if (artifactSourceBranch == null) {
          if (packageMetadata.branch) {
            artifactSourceBranch = packageMetadata.branch;
          } else {
            console.log(`${packageMetadata.package_name} artifact is missing branch information`);
            console.log(`This will cause an error in the future. Re-create the artifact using the latest version of sfpowerscripts to maintain compatibility.`)
          }
        } else if (artifactSourceBranch !== packageMetadata.branch) {
          // TODO: throw error
          console.log("Artifacts must be created from the same branch");
        }
      }

      if (!artifactSourceBranch)
        throw new Error("Atleast one artifact must carry branch information");

      const repoTempDir = tempDir.name;

      let git: SimpleGit = simplegit(repoTempDir);

      console.log(`Cloning repository ${this.repoUrl}`);
      await git.clone(
        this.repoUrl,
        repoTempDir
      );


      const branch = `sfp_changelog_${artifactSourceBranch}`;
      console.log(`Checking out branch ${branch}`);
      if (await this.isBranchExists(branch, git)) {
        await git.checkout(branch);
      } else {
        await git.checkout(['-b', branch]);
      }

      let releaseChangelog: ReleaseChangelog;
      if (fs.existsSync(path.join(repoTempDir,`releasechangelog.json`))) {
        releaseChangelog = JSON.parse(fs.readFileSync(path.join(repoTempDir,`releasechangelog.json`), 'utf8'));
      }


      console.log("Generating changelog...");

      let buildNumber: number;
      if (releaseChangelog?.releases[releaseChangelog.releases.length - 1].buildNumber) {
        buildNumber = releaseChangelog.releases[releaseChangelog.releases.length - 1].buildNumber + 1;
      } else {
        buildNumber = 1;
      }

      let latestRelease: Release = this.initLatestRelease(
        this.releaseName,
        buildNumber,
        artifactsToPackageMetadata
      );

      // Determine whether or not to create a new release entry
      if (! await this.isNewRelease(releaseChangelog, latestRelease, repoTempDir, branch, git)) {
        return;
      }

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

      releaseChangelog = this.addLatestReleaseToChangelog(latestRelease, releaseChangelog);

      fs.writeFileSync(
        path.join(repoTempDir,`releasechangelog.json`),
        JSON.stringify(releaseChangelog, null, 4)
      );

      console.log(marked(generateMarkdown(releaseChangelog, this.workItemUrl, 1, false)));

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

      await this.pushChangelogToBranch(branch, git, this.forcePush);

      console.log(`Successfully generated changelog`);
    } finally {
      tempDir.removeCallback();
    }
  }

  /**
   * Convert Release to Release Id
   * @param release
   * @returns
   */
  private convertReleaseToId(release: Release): ReleaseId {
    let releaseNames = [...release.names]; // Shallow copy
    return {
      names: releaseNames,
      buildNumber: release.buildNumber,
      hashId: release.hashId
    }
  }

  private addLatestReleaseToChangelog(latestRelease: Release, releaseChangelog: ReleaseChangelog) {
    if (releaseChangelog) {
      // update org
      if (releaseChangelog.orgs) {
        let org = releaseChangelog.orgs.find((org) => org.name === this.org);

        if (org) {
          org.releases.push(this.convertReleaseToId(latestRelease));
          org.indexOfLatestRelease = org.releases.length - 1;
          org.retryCount = 0;
        } else {
          releaseChangelog.orgs.push({ name: this.org, releases: [this.convertReleaseToId(latestRelease)], indexOfLatestRelease: 0, retryCount: 0 });
        }
      } else {
        // for backwards-compatibility with pre-existing changelogs
        releaseChangelog.orgs = [{ name: this.org, releases: [this.convertReleaseToId(latestRelease)], indexOfLatestRelease: 0 ,retryCount: 0 }];
      }

      // Append results to release changelog
      releaseChangelog["releases"].push(latestRelease);
    } else {
      releaseChangelog = {
        orgs: [{ name: this.org, releases: [this.convertReleaseToId(latestRelease)], indexOfLatestRelease: 0, retryCount: 0 }],
        releases: [latestRelease]
      };
    }
    return releaseChangelog;
  }

  /**
   * Determine whether new release based on hash Id
   * @param releaseChangelog
   * @param latestRelease
   * @param repoTempDir
   * @param branch
   * @param git
   * @returns
   */
  private async isNewRelease(
    releaseChangelog: ReleaseChangelog,
    latestRelease: Release,
    repoTempDir: any,
    branch: string,
    git: SimpleGit
  ) {
    if (releaseChangelog?.releases.length > 0) {
      for (let release of releaseChangelog.releases) {
        if (release.hashId === latestRelease.hashId) {
          // Not a new release
          console.log(`Found previous release with identical hash Id ${release.hashId}`);
          console.log(`Updating ${this.org} org`);

          let containsLatestReleaseName = this.containsLatestReleaseName(release.names, latestRelease.names[0]);
          if (!containsLatestReleaseName) {
            // append latestReleaseName
            release.names.push(latestRelease.names[0]);
          }

          // for (let org of releaseChangelog.orgs) {
          //   if (org.release.hashId === release.hashId) {
          //     // Update org release with newer release that contains additional release name
          //     org.release = release;
          //   }
          // }

          // Update orgs
          let org = releaseChangelog.orgs.find((org) => org.name === this.org);

          if (org) {
            let latestReleaseToOrg = org.releases[org.indexOfLatestRelease];
            if (latestReleaseToOrg.hashId !== release.hashId) {
              let indexOfOrgRelease = org.releases.findIndex((orgRelease) => orgRelease.hashId === release.hashId);
              if ( indexOfOrgRelease >= 0 ) {
                // Update pointer to latest release
                org.indexOfLatestRelease = indexOfOrgRelease;

                org.releases[org.indexOfLatestRelease] = this.convertReleaseToId(release);
              } else {
                // Add releaseId to Org
                org.releases.push(this.convertReleaseToId(release));
                org.indexOfLatestRelease = org.releases.length - 1;
              }
              org.retryCount = 0;
            } else {
              org.releases[org.indexOfLatestRelease] = this.convertReleaseToId(release);
              if (!containsLatestReleaseName) org.retryCount = 0;
              else org.retryCount++;
            }

            latestReleaseToOrg = org.releases[org.indexOfLatestRelease];
            console.log(latestReleaseToOrg.names[latestReleaseToOrg.names.length - 1] + "-" + latestReleaseToOrg.buildNumber + `(${org.retryCount})`);
          } else {
            // new org
            releaseChangelog.orgs.push({ name: this.org, releases: [this.convertReleaseToId(release)], indexOfLatestRelease: 0, retryCount: 0 });
            console.log(`${release.names[release.names.length - 1]}-${release.buildNumber}(0)`);
          }

          fs.writeFileSync(
            path.join(repoTempDir, `releasechangelog.json`),
            JSON.stringify(releaseChangelog, null, 4)
          );

          let payload: string = generateMarkdown(
            releaseChangelog,
            this.workItemUrl,
            this.limit,
            this.showAllArtifacts
          );

          fs.writeFileSync(
            path.join(repoTempDir, `Release-Changelog.md`),
            payload
          );

          await this.pushChangelogToBranch(branch, git, this.forcePush);

          return false;
        }
      }
    }

    return true;
  }

  private containsLatestReleaseName(
    releaseNames: string[],
    latestReleaseName: string
  ): boolean {
    return releaseNames.find((name) => name.toLowerCase() === latestReleaseName.toLowerCase()) ? true : false;
  }

  private async pushChangelogToBranch(branch: string, git, isForce: boolean) {
    console.log("Pushing changelog files to", this.repoUrl, branch);
    await git.addConfig("user.name", "sfpowerscripts");
    await git.addConfig("user.email", "sfpowerscripts@dxscale");
    await git.add([`releasechangelog.json`, `Release-Changelog.md`]);
    await git.commit(`[skip ci] Updated Changelog ${this.releaseName}`);

    if (isForce) {
      await git.push("origin", branch, [`--force`]);
    } else {
      await git.push("origin", branch);
    }
  }

  private async isBranchExists(branch: string, git: SimpleGit): Promise<boolean> {
    const listOfBranches = await git.branch(['-la']);

    return listOfBranches.all.find((elem) => elem.endsWith(branch)) ? true : false;
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
    buildNumber: number,
    artifactsToPackageMetadata: { [p: string]: PackageMetadata; },
  ): Release {

    let latestRelease: Release = {
      names: [releaseName],
      buildNumber: buildNumber,
      workItems: {},
      artifacts: [],
      hashId: undefined
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

    latestRelease.hashId = hash(latestRelease.artifacts);


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
