import { Release } from './ReleaseChangelog';
import { Changelog as PackageChangelog } from '@dxatscale/sfpowerscripts.core/lib/changelog/interfaces/GenericChangelogInterfaces';
import ReadPackageChangelog from './ReadPackageChangelog';

export default class CommitUpdater {
    constructor(
        private latestRelease: Release,
        private artifactsToLatestCommitId: { [p: string]: string },
        private packagesToChangelogFilePaths: { [p: string]: string },
        private readPackageChangelog: ReadPackageChangelog
    ) {}

    /**
     * Generate commits in latest release, for each artifact
     * Also sets new latestCommitId for artifacts
     * @returns
     */
    update(): void {
        for (let artifact of this.latestRelease['artifacts']) {
            let packageChangelog: PackageChangelog = this.readPackageChangelog(
                this.packagesToChangelogFilePaths[artifact.name]
            );

            // Set new latestCommitId
            artifact['latestCommitId'] = packageChangelog['commits'][0]['commitId'];

            let indexOfLatestCommitId;
            if (this.artifactsToLatestCommitId?.[artifact.name]) {
                indexOfLatestCommitId = packageChangelog['commits'].findIndex(
                    (commit) => commit['commitId'] === this.artifactsToLatestCommitId[artifact.name]
                );
                if (indexOfLatestCommitId === -1) {
                    console.log(
                        `Cannot find commit Id ${this.artifactsToLatestCommitId[artifact.name]} in ${
                            artifact.name
                        } changelog`
                    );
                    console.log('Assuming that there are no changes...');
                    artifact['commits'] = [];
                    continue;
                }
            }

            if (indexOfLatestCommitId > 0) {
                artifact['commits'] = packageChangelog['commits'].slice(0, indexOfLatestCommitId);
            } else if (indexOfLatestCommitId === 0) {
                // Artifact verison has not changed
                artifact['commits'] = [];
                // Skip to next artifact
                continue;
            } else if (indexOfLatestCommitId === undefined) {
                // Artifact was not in previous release
                artifact['commits'] = packageChangelog['commits'];
            }
        }
    }
}
