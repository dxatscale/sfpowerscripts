import { ReleaseChangelog, Release, ReleaseId } from "@dxatscale/sfpowerscripts.core/lib/changelog/interfaces/ReleaseChangelogInterfaces";
import lodash = require("lodash");

export default class OrgsUpdater {
  private isNewRelease: boolean;
  private releaseWithMatchingHashId: ReleaseId;
  private latestReleaseId: ReleaseId;

  constructor(
    private releaseChangelog: ReleaseChangelog,
    private latestRelease: Release,
    private org: string
  ) {
    this.isNewRelease = true;
    if (releaseChangelog.releases.length > 0) {
      for (let release of releaseChangelog.releases) {
        if (release.hashId === latestRelease.hashId) {
          console.log(`Found previous release with identical hash Id ${release.hashId}`);
          this.isNewRelease = false;
          this.releaseWithMatchingHashId = this.convertReleaseToId(release);
          break;
        }
      }
    }

    this.latestReleaseId = this.convertReleaseToId(this.latestRelease);
  }

  update(): void {
    if (this.isNewRelease) {
      if (this.releaseChangelog.orgs) {
        let org = this.releaseChangelog.orgs.find((org) => org.name === this.org);

        if (org) {
          org.releases.push(this.latestReleaseId);
          org.latestRelease = org.releases[org.releases.length - 1];
          org.retryCount = 0;
        } else {
          this.releaseChangelog.orgs.push({ name: this.org, releases: [this.latestReleaseId], latestRelease: this.latestReleaseId, retryCount: 0 });
        }
      } else {
        // for backwards-compatibility with pre-existing changelogs
        this.releaseChangelog.orgs = [{ name: this.org, releases: [this.latestReleaseId], latestRelease: this.latestReleaseId ,retryCount: 0 }];
      }
      console.log(`Updating ${this.org} org with`, this.latestRelease.names[this.latestRelease.names.length - 1] + "-" + this.latestRelease.buildNumber + `(0)`);
    } else {
          // Update orgs
          let org = this.releaseChangelog.orgs.find((org) => org.name === this.org);

          if (org) {
            let indexOfReleaseToOrg = org.releases.findIndex((orgRelease) => orgRelease.hashId === this.releaseWithMatchingHashId.hashId);
            if (org.latestRelease.hashId !== this.releaseWithMatchingHashId.hashId) {
              if ( indexOfReleaseToOrg >= 0 ) {
                // Update release names in releases to org
                org.releases[indexOfReleaseToOrg] = this.releaseWithMatchingHashId;
              } else {
                // Add releaseId in releases to org
                org.releases.push(this.releaseWithMatchingHashId);
              }

              // Update latest release
              org.latestRelease = this.releaseWithMatchingHashId;
              org.retryCount = 0;
            } else {
              if (lodash.isEqual(org.releases[indexOfReleaseToOrg], this.releaseWithMatchingHashId)) {
                org.retryCount++;
              } else {
                org.retryCount = 0;
              }

              // Update releases names in releases to org & latestRelease
              org.releases[indexOfReleaseToOrg] = this.releaseWithMatchingHashId;
              org.latestRelease = this.releaseWithMatchingHashId;
            }

            console.log(`Updating ${this.org} org with`, org.latestRelease.names[org.latestRelease.names.length - 1] + "-" + org.latestRelease.buildNumber + `(${org.retryCount})`);
          } else {
            // new org
            this.releaseChangelog.orgs.push({ name: this.org, releases: [this.releaseWithMatchingHashId], latestRelease: this.releaseWithMatchingHashId, retryCount: 0 });
            console.log(`Updating ${this.org} org with`, `${this.releaseWithMatchingHashId.names[this.releaseWithMatchingHashId.names.length - 1]}-${this.releaseWithMatchingHashId.buildNumber}(0)`);
          }
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
}
