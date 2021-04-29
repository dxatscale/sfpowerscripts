import { ReleaseChangelog, Release, Artifact } from "@dxatscale/sfpowerscripts.core/lib/changelog/interfaces/ReleaseChangelogInterfaces";
import PackageMetadata from "@dxatscale/sfpowerscripts.core/lib/PackageMetadata";
import CommitUpdater from "./CommitUpdater";
import WorkItemUpdater from "./WorkItemUpdater";
import OrgsUpdater from "./OrgsUpdater";
var hash = require('object-hash');

export default class ReleaseChangelogUpdater {

  constructor(
    private releaseChangelog: ReleaseChangelog,
    private releaseName: string,
    private artifactsToPackageMetadata: {[p: string]: PackageMetadata},
    private packagesToChangelogFilePaths: {[p: string]: string},
    private workItemFilter: string,
    private org: string
  ) {}

  update(): ReleaseChangelog {

    let buildNumber: number;
    if (this.releaseChangelog.releases[this.releaseChangelog.releases.length - 1]?.buildNumber) {
      buildNumber = this.releaseChangelog.releases[this.releaseChangelog.releases.length - 1].buildNumber + 1;
    } else {
      buildNumber = 1;
    }

    let latestRelease: Release = this.initLatestRelease(
      this.releaseName,
      buildNumber,
      this.artifactsToPackageMetadata
    );

    new OrgsUpdater(
      this.releaseChangelog,
      latestRelease,
      this.org
    ).update();

    if (this.isNewRelease(this.releaseChangelog, latestRelease)) {

      let artifactsToLatestCommitId: {[P: string]: string};
      if (this.releaseChangelog.releases.length > 0) {
        artifactsToLatestCommitId = this.getArtifactsToLatestCommitId(
          this.releaseChangelog,
          latestRelease
        );
      };

      new CommitUpdater(
        latestRelease,
        artifactsToLatestCommitId,
        this.packagesToChangelogFilePaths
      ).update();

      new WorkItemUpdater(
        latestRelease,
        this.workItemFilter
      ).update();

      this.releaseChangelog.releases.push(latestRelease);
    }

    return this.releaseChangelog;
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

  /**
   * Determine whether new release based on hash Id
   * @param releaseChangelog
   * @param latestRelease
   * @returns
   */
  private isNewRelease(
    releaseChangelog: ReleaseChangelog,
    latestRelease: Release
  ): boolean {
    if (releaseChangelog.releases.length > 0) {
      for (let release of releaseChangelog.releases) {
        if (release.hashId === latestRelease.hashId) {
          return false;
        }
      }
    }

    return true;
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
}
