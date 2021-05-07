import { ReleaseChangelog, Release, org } from "./ReleaseChangelogInterfaces";
import { URL } from "url";
const markdownTable = require("markdown-table");

export default class ChangelogMarkdownGenerator {
  constructor(
    private releaseChangelog: ReleaseChangelog,
    private workItemURL: string,
    private limit: number,
    private showAllArtifacts: boolean
  ) {}

  /**
   * Generate markdown from ReleaseChangelog
   * @returns
   */
  generate(): string {
    let payload: string = "";

    if (this.releaseChangelog.orgs) {
      payload = this.generateOrgs(this.releaseChangelog.orgs,payload);
    }

    payload = this.generateReleases(payload);

    return payload;
  }

  private generateReleases(payload: string): string {
    let limitReleases: number;
    if (this.limit <= this.releaseChangelog.releases.length)
      limitReleases = this.releaseChangelog.releases.length - this.limit;
    else limitReleases = 0; // no limit

    // Generate in descending order, starting from latest release
    for (let releaseNum = this.releaseChangelog.releases.length - 1; releaseNum >= limitReleases; releaseNum--) {
      let release: Release = this.releaseChangelog.releases[releaseNum];

      payload += `\n<a id=${release.hashId}></a>\n`; // Create anchor from release hash Id
      payload += `# ${this.concatReleaseNames(
        release.names,
        release.buildNumber
      )}\n`;

      payload = this.generateArtifacts(payload, release);

      payload = this.generateWorkItems(payload, release);

      let versionChangeOnly: string[] = [];
      let noChangeInVersion: string[] = [];
      payload = this.generateCommits(payload, release, versionChangeOnly, noChangeInVersion);

      if (versionChangeOnly.length > 0) {
        payload += "\n### Additional Information\n";
        payload += `The following artifacts' version may have changed due to an update in the scratch org definition file, `;
        payload += `incremented package version in SFDX project configuration, or build all packages:\n`;

        versionChangeOnly.forEach(
          (artifactName) => (payload += `  - ${artifactName}\n`)
        );
      }

      if (noChangeInVersion.length > 0 && this.showAllArtifacts) {
        payload += "\nArtifacts with no changes:\n";
        noChangeInVersion.forEach(
          (artifactName) => (payload += `  - ${artifactName}\n`)
        );
      }
    }
    return payload;
  }

  private generateCommits(payload: string, release: Release, versionChangeOnly: string[], noChangeInVersion: string[]) {
    let isCommitsSectionEmpty: boolean = true;

    payload += "\n### Commits :book:\n";
    for (let artifact of release.artifacts) {
      if (artifact.from !== artifact.to) {
        if (artifact.commits.length > 0) {
          isCommitsSectionEmpty = false;
          payload += `\n#### ${artifact.name}\n`;

          let tableOfCommits = [
            ["Date", "Time", "Commit ID", "Commit Message"],
          ];
          for (let commit of artifact.commits) {
            let commitDate: Date = new Date(commit.date);
            tableOfCommits.push([
              this.getDate(commitDate),
              this.getTime(commitDate),
              commit.commitId,
              commit.message,
            ]);
          }
          payload += markdownTable(tableOfCommits) + "\n";
        } else {
          versionChangeOnly.push(artifact.name);
        }
      } else if (artifact.from === artifact.to) {
        noChangeInVersion.push(artifact.name);
      }
    }

    if (isCommitsSectionEmpty) {
      payload += `N/A\n`;
    }
    return payload;
  }

  private generateWorkItems(payload: string, release: Release) {
    payload += "### Work Items :gem:\n";
    if (Object.keys(release.workItems).length > 0) {
      for (let workItem in release.workItems) {
        let specificWorkItemURL: string;
        if (this.workItemURL != null) {
          if (this.workItemURL.endsWith("/")) {
            specificWorkItemURL = this.workItemURL.concat(workItem);
          } else {
            specificWorkItemURL = this.workItemURL.concat(`/${workItem}`);
          }
        }
        payload += `  - [${workItem}](${specificWorkItemURL})\n`;
      }
    } else {
      payload += `N/A\n`;
    }
    return payload;
  }

  private generateArtifacts(payload: string, release: Release) {
    payload += "### Artifacts :package:\n";
    for (let artifactNum = 0; artifactNum < release.artifacts.length; artifactNum++) {
      if (release.artifacts[artifactNum].from !==
        release.artifacts[artifactNum].to ||
        this.showAllArtifacts)
        payload += `- **${release.artifacts[artifactNum].name}**     v${release.artifacts[artifactNum].version} (${release.artifacts[artifactNum].to})\n\n`;
    }
    return payload;
  }

  private generateOrgs(orgs: org[], payload: string) {
    const baseAddr = "https://img.shields.io/static/v1";
    for (let org of orgs) {
      let url = new URL(
        `?label=${org.name}&message=${org.latestRelease.names[org.latestRelease.names.length - 1]}-${org.latestRelease.buildNumber}(${org.retryCount})&color=green`,
        baseAddr
      );
      payload += `[![${org.name}-${org.latestRelease.names[org.latestRelease.names.length - 1]}-${org.latestRelease.buildNumber}(${org.retryCount})-green](${url.toString()})](#${org.latestRelease.hashId}) `;
    }
    return payload;
  }

  private concatReleaseNames(
    releaseNames: string[],
    buildNumber: number
  ): string {
    return releaseNames.map((name) => name + "-" + buildNumber).join("/");
  }

  private getDate(date: Date): string {
    let day: number = date.getDate();
    let month: number = date.getMonth();
    let year: number = date.getFullYear();
    let pad = (n) => (n < 10 ? "0" + n : n);

    return pad(day) + "/" + pad(month + 1) + "/" + year;
  }

  private getTime(date: Date): string {
    let hours: number = date.getHours();
    let minutes: number = date.getMinutes();
    let seconds: number = date.getSeconds();
    let pad = (n) => (n < 10 ? "0" + n : n);

    return pad(hours) + ":" + pad(minutes) + ":" + pad(seconds);
  }
}
