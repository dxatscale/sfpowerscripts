import { ReleaseChangelog, Release, ReleaseId } from "./ReleaseChangelogInterfaces";
import lodash = require("lodash");

export default class OrgsUpdater {
  private latestReleaseId: ReleaseId;
  private idOfReleaseWithMatchingHashId: ReleaseId;

  constructor(
    private releaseChangelog: ReleaseChangelog,
    private latestRelease: Release,
    private org: string,
    private releaseWithMatchingHashId: Release
  ) {
    this.latestReleaseId = this.convertReleaseToId(this.latestRelease);

    if (this.releaseWithMatchingHashId) {
      this.idOfReleaseWithMatchingHashId = this.convertReleaseToId(this.releaseWithMatchingHashId);
    }
  }

  update(): void {
    if (!this.idOfReleaseWithMatchingHashId) {
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
            let indexOfReleaseToOrg = org.releases.findIndex((orgRelease) => orgRelease.hashId === this.idOfReleaseWithMatchingHashId.hashId);
            if (org.latestRelease.hashId !== this.idOfReleaseWithMatchingHashId.hashId) {
              if ( indexOfReleaseToOrg >= 0 ) {
                // Update release names in releases to org
                org.releases[indexOfReleaseToOrg] = this.idOfReleaseWithMatchingHashId;
              } else {
                // Add releaseId in releases to org
                org.releases.push(this.idOfReleaseWithMatchingHashId);
              }

              // Update latest release
              org.latestRelease = this.idOfReleaseWithMatchingHashId;
              org.retryCount = 0;
            } else {
              if (lodash.isEqual(org.releases[indexOfReleaseToOrg], this.idOfReleaseWithMatchingHashId)) {
                org.retryCount++;
              } else {
                org.retryCount = 0;
              }

              // Update releases names in releases to org & latestRelease
              org.releases[indexOfReleaseToOrg] = this.idOfReleaseWithMatchingHashId;
              org.latestRelease = this.idOfReleaseWithMatchingHashId;
            }

            console.log(`Updating ${this.org} org with`, org.latestRelease.names[org.latestRelease.names.length - 1] + "-" + org.latestRelease.buildNumber + `(${org.retryCount})`);
          } else {
            // new org
            this.releaseChangelog.orgs.push({ name: this.org, releases: [this.idOfReleaseWithMatchingHashId], latestRelease: this.idOfReleaseWithMatchingHashId, retryCount: 0 });
            console.log(`Updating ${this.org} org with`, `${this.idOfReleaseWithMatchingHashId.names[this.idOfReleaseWithMatchingHashId.names.length - 1]}-${this.idOfReleaseWithMatchingHashId.buildNumber}(0)`);
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
