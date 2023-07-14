import { ReleaseChangelog, Release, Artifact } from './ReleaseChangelog';
import CommitUpdater from './CommitUpdater';
import WorkItemUpdater from './WorkItemUpdater';
import OrgsUpdater from './OrgsUpdater';
import ReadPackageChangelog from './ReadPackageChangelog';
import * as fs from 'fs-extra';
import SfpPackage from '@dxatscale/sfpowerscripts.core/lib/package/SfpPackage';
const hash = require('object-hash');

export default class ReleaseChangelogUpdater {
    constructor(
        private releaseChangelog: ReleaseChangelog,
        private releaseName: string,
        private artifactsToSfpPackage: { [p: string]: SfpPackage },
        private packagesToChangelogFilePaths: { [p: string]: string },
        private workItemFilters: string[],
        private org: string
    ) { }

    update(): ReleaseChangelog {
        let buildNumber: number;
        if (this.releaseChangelog.releases[this.releaseChangelog.releases.length - 1]?.buildNumber) {
            buildNumber = this.releaseChangelog.releases[this.releaseChangelog.releases.length - 1].buildNumber + 1;
        } else {
            buildNumber = 1;
        }

        const latestRelease: Release = this.initLatestRelease(this.releaseName, buildNumber, this.artifactsToSfpPackage);

        const releaseWithMatchingHashId = this.findRelease(this.releaseChangelog.releases, latestRelease);
        if (!releaseWithMatchingHashId) {



            let artifactsToLatestCommitId: { [P: string]: string };
            if (this.releaseChangelog.releases.length > 0) {
                artifactsToLatestCommitId = this.getArtifactsToLatestCommitId(this.releaseChangelog, latestRelease);
            }

            const readPackageChangelog: ReadPackageChangelog = (changelogFilePath: string) => {
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
        const artifactsToLatestCommitId: { [P: string]: string } = {};

        for (const latestReleaseArtifact of latestRelease.artifacts) {
            loopThroughReleases: for (let i = releaseChangelog.releases.length - 1; i >= 0; i--) {
                for (const artifact of releaseChangelog.releases[i].artifacts) {
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
    private findRelease(releases: Release[], latestRelease: Release): Release | null {
        let foundRelease: Release | null = null;
    
        if (releases.length > 0) {
            // First level matching with hashId
            foundRelease = releases.find(release => release.hashId === latestRelease.hashId);
    
            // If not found by hashId, proceed to next level matching with names and artifacts
            if (foundRelease == null) {
                // Create a map for constant time lookup of all release's artifacts
                const allArtifacts = new Map<string, string[]>();
                for (const release of releases) {
                    for (const artifact of release.artifacts) {
                        if (allArtifacts.has(artifact.name)) {
                            allArtifacts.get(artifact.name).push(artifact.version);
                        } else {
                            allArtifacts.set(artifact.name, [artifact.version]);
                        }
                    }
                }
    
                // Check if all artifacts in the latest release exist in previous releases
                let isAllArtifactsAlreadyAvailablePreviously: boolean = true;
                for (const artifact of latestRelease.artifacts) {
                    if (!allArtifacts.has(artifact.name) || !allArtifacts.get(artifact.name).includes(artifact.version)) {
                        isAllArtifactsAlreadyAvailablePreviously = false;
                        break;
                    }
                }
    
                // If all artifacts match, check for names
                if (isAllArtifactsAlreadyAvailablePreviously) {
                    for (const release of releases) {
                        if (release.names.includes(latestRelease.names[0])) {
                            foundRelease = release;
                            break;
                        }
                    }
                }
            }
        }
    
        return foundRelease;
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
        const latestRelease: Release = {
            names: [releaseName],
            buildNumber: buildNumber,
            workItems: {},
            artifacts: [],
            hashId: undefined,
        };

        for (const sfpPackage of Object.values(artifactsToSfpPackage)) {
            const artifact: Artifact = {
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
