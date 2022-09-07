import { ReleaseChangelog, Release, Artifact } from './ReleaseChangelog';
import CommitUpdater from './CommitUpdater';
import WorkItemUpdater from './WorkItemUpdater';
import OrgsUpdater from './OrgsUpdater';
import ReadPackageChangelog from './ReadPackageChangelog';
import * as fs from 'fs-extra';
import SfpPackage from '@dxatscale/sfpowerscripts.core/lib/package/SfpPackage';
var hash = require('object-hash');

export default class ReleaseChangelogUpdater {
    constructor(
        private releaseChangelog: ReleaseChangelog,
        private releaseName: string,
        private artifactsToSfpPackage: { [p: string]: SfpPackage },
        private packagesToChangelogFilePaths: { [p: string]: string },
        private workItemFilters: string[],
        private org: string
    ) {}

    update(): ReleaseChangelog {
        let buildNumber: number;
        if (this.releaseChangelog.releases[this.releaseChangelog.releases.length - 1]?.buildNumber) {
            buildNumber = this.releaseChangelog.releases[this.releaseChangelog.releases.length - 1].buildNumber + 1;
        } else {
            buildNumber = 1;
        }

        let latestRelease: Release = this.initLatestRelease(this.releaseName, buildNumber, this.artifactsToSfpPackage);

        let releaseWithMatchingHashId = this.findRelease(this.releaseChangelog.releases, latestRelease.hashId);
        if (!releaseWithMatchingHashId) {
            let artifactsToLatestCommitId: { [P: string]: string };
            if (this.releaseChangelog.releases.length > 0) {
                artifactsToLatestCommitId = this.getArtifactsToLatestCommitId(this.releaseChangelog, latestRelease);
            }

            let readPackageChangelog: ReadPackageChangelog = (changelogFilePath: string) => {
                return JSON.parse(fs.readFileSync(changelogFilePath, 'utf8'));
            };

            new CommitUpdater(
                latestRelease,
                artifactsToLatestCommitId,
                this.packagesToChangelogFilePaths,
                readPackageChangelog
            ).update();

            new WorkItemUpdater(latestRelease, this.workItemFilters).update();

            this.releaseChangelog.releases.push(latestRelease);
        } else {
            if (!this.containsLatestReleaseName(releaseWithMatchingHashId.names, latestRelease.names[0])) {
                // append latestReleaseName
                releaseWithMatchingHashId.names.push(latestRelease.names[0]);
            }
        }

        if (this.org) {
            new OrgsUpdater(this.releaseChangelog, latestRelease, this.org, releaseWithMatchingHashId).update();
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
        let artifactsToLatestCommitId: { [P: string]: string } = {};

        for (let latestReleaseArtifact of latestRelease.artifacts) {
            loopThroughReleases: for (let i = releaseChangelog.releases.length - 1; i >= 0; i--) {
                for (let artifact of releaseChangelog.releases[i].artifacts) {
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
     * Finds release with matching hash Id
     * Returns null if match cannot be found
     * @param releaseChangelog
     * @param latestRelease
     * @returns
     */
    private findRelease(releases: Release[], hashId: string): Release {
        if (releases.length > 0) {
            for (let release of releases) {
                if (release.hashId === hashId) {
                    return release;
                }
            }
        }

        return null;
    }

    /**
     * Initalise latest release
     * @param releaseName
     * @param artifactsToSfpPackage
     * @returns
     */
    private initLatestRelease(
        releaseName: string,
        buildNumber: number,
        artifactsToSfpPackage: { [p: string]: SfpPackage }
    ): Release {
        let latestRelease: Release = {
            names: [releaseName],
            buildNumber: buildNumber,
            workItems: {},
            artifacts: [],
            hashId: undefined,
        };

        for (let sfpPackage of Object.values(artifactsToSfpPackage)) {
            let artifact: Artifact = {
                name: sfpPackage.packageName,
                from: undefined,
                to: sfpPackage.sourceVersion?.slice(0, 8),
                version: sfpPackage.package_version_number,
                latestCommitId: undefined,
                commits: undefined,
            };

            latestRelease['artifacts'].push(artifact);
        }

        latestRelease.hashId = hash(latestRelease.artifacts);
        latestRelease.date = new Date().toString();

        return latestRelease;
    }

    private containsLatestReleaseName(releaseNames: string[], latestReleaseName: string): boolean {
        return releaseNames.find((name) => name.toLowerCase() === latestReleaseName.toLowerCase()) ? true : false;
    }
}
