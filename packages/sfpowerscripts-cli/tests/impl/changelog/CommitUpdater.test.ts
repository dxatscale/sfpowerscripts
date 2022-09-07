import { expect } from '@jest/globals';
import CommitUpdater from '../../../src/impl/changelog/CommitUpdater';
import ReadPackageChangelog from '../../../src/impl/changelog/ReadPackageChangelog';
import { Changelog as PackageChangelog } from '@dxatscale/sfpowerscripts.core/lib/changelog/interfaces/GenericChangelogInterfaces';
import { Release } from '../../../src/impl/changelog/ReleaseChangelog';
const path = require('path');
import * as fs from 'fs-extra';

describe('Given a CommitUpdater', () => {
    let packagesToChangelogFilePaths: { [p: string]: string } = {
        ESBaseCodeLWC: 'path/to/ESBaseCodeLWCChangelog',
        ESBaseStylesLWC: 'path/to/ESBaseStylesLWCChangelog',
        ESObjects: 'path/to/ESObjectsChangelog',
        ESSpaceMgmtLWC: 'path/to/ESSpaceMgmtLWCChangelog',
    };

    let resourcesDir: string = path.join(__dirname, 'resources');

    let readPackageChangelog: ReadPackageChangelog = (changelogFilePath: string) => {
        let packageChangelog: PackageChangelog;

        switch (path.basename(changelogFilePath)) {
            case 'ESBaseCodeLWCChangelog':
                packageChangelog = fs.readJSONSync(path.join(resourcesDir, 'ESBaseCodeLWCChangelog.json'), {
                    encoding: 'UTF-8',
                });
                break;
            case 'ESBaseStylesLWCChangelog':
                packageChangelog = fs.readJSONSync(path.join(resourcesDir, 'ESBaseStylesLWCChangelog.json'), {
                    encoding: 'UTF-8',
                });
                break;
            case 'ESObjectsChangelog':
                packageChangelog = fs.readJSONSync(path.join(resourcesDir, 'ESObjectsChangelog.json'), {
                    encoding: 'UTF-8',
                });
                break;
            case 'ESSpaceMgmtLWCChangelog':
                packageChangelog = fs.readJSONSync(path.join(resourcesDir, 'ESSpaceMgmtLWCChangelog.json'), {
                    encoding: 'UTF-8',
                });
                break;
            default:
                throw new Error('No changelog for artifact');
        }
        return packageChangelog;
    };

    it('should update latestRelease with all commits', () => {
        let latestRelease: Release = {
            names: ['release-1'],
            buildNumber: 1,
            workItems: {},
            artifacts: [
                {
                    name: 'ESBaseCodeLWC',
                    from: undefined,
                    to: '2dbd257',
                    version: '50.0.5.6',
                    latestCommitId: undefined,
                    commits: [],
                },
                {
                    name: 'ESBaseStylesLWC',
                    from: undefined,
                    to: '2dbd257',
                    version: '50.0.5.6',
                    latestCommitId: undefined,
                    commits: [],
                },
                {
                    name: 'ESObjects',
                    from: undefined,
                    to: '2dbd257',
                    version: '50.0.5.6',
                    latestCommitId: undefined,
                    commits: [],
                },
                {
                    name: 'ESSpaceMgmtLWC',
                    from: undefined,
                    to: '2dbd257',
                    version: '50.0.4.6',
                    latestCommitId: undefined,
                    commits: [],
                },
            ],
            hashId: 'c97e09b76f82d830731359abe1bab2c9c5be13a9',
        };

        new CommitUpdater(latestRelease, undefined, packagesToChangelogFilePaths, readPackageChangelog).update();

        expect(latestRelease).toEqual(
            fs.readJSONSync(
                path.join(resourcesDir, 'ExpectedResults', 'should_update_latestRelease_with_all_commits.json'),
                { encoding: 'UTF-8' }
            )
        );
    });

    it('should update latestRelease with subset of commits', () => {
        let latestRelease: Release = {
            names: ['release-1'],
            buildNumber: 1,
            workItems: {},
            artifacts: [
                {
                    name: 'ESBaseCodeLWC',
                    from: '15cb14b',
                    to: '2dbd257',
                    version: '50.0.5.6',
                    latestCommitId: undefined,
                    commits: [],
                },
                {
                    name: 'ESBaseStylesLWC',
                    from: '15cb14b',
                    to: '2dbd257',
                    version: '50.0.5.6',
                    latestCommitId: undefined,
                    commits: [],
                },
                {
                    name: 'ESObjects',
                    from: '15cb14b',
                    to: '2dbd257',
                    version: '50.0.5.6',
                    latestCommitId: undefined,
                    commits: [],
                },
                {
                    name: 'ESSpaceMgmtLWC',
                    from: '15cb14b',
                    to: '2dbd257',
                    version: '50.0.4.6',
                    latestCommitId: undefined,
                    commits: [],
                },
            ],
            hashId: 'c97e09b76f82d830731359abe1bab2c9c5be13a9',
        };

        let artifactsToLatestCommitId: { [p: string]: string } = {
            ESBaseCodeLWC: 'e88a3919',
            ESBaseStylesLWC: '5414295c',
            ESObjects: '5c0d9381',
            ESSpaceMgmtLWC: 'a155ee7a',
        };

        new CommitUpdater(
            latestRelease,
            artifactsToLatestCommitId,
            packagesToChangelogFilePaths,
            readPackageChangelog
        ).update();

        expect(latestRelease).toEqual(
            fs.readJSONSync(
                path.join(resourcesDir, 'ExpectedResults', 'should_update_latestRelease_with_subset_of_commits.json'),
                { encoding: 'UTF-8' }
            )
        );
    });

    it('should update latestRelease with empty commits', () => {
        let latestRelease: Release = {
            names: ['release-1'],
            buildNumber: 1,
            workItems: {},
            artifacts: [
                {
                    name: 'ESBaseCodeLWC',
                    from: '2dbd257',
                    to: '2dbd257',
                    version: '50.0.5.6',
                    latestCommitId: undefined,
                    commits: [],
                },
            ],
            hashId: 'c97e09b76f82d830731359abe1bab2c9c5be13a9',
        };

        // same artifact version
        let artifactsToLatestCommitId: { [p: string]: string } = {
            ESBaseCodeLWC: '2dbd257',
        };

        new CommitUpdater(
            latestRelease,
            artifactsToLatestCommitId,
            packagesToChangelogFilePaths,
            readPackageChangelog
        ).update();

        expect(latestRelease).toEqual({
            names: ['release-1'],
            buildNumber: 1,
            workItems: {},
            artifacts: [
                {
                    name: 'ESBaseCodeLWC',
                    from: '2dbd257',
                    to: '2dbd257',
                    version: '50.0.5.6',
                    latestCommitId: 'c8dbab13',
                    commits: [],
                },
            ],
            hashId: 'c97e09b76f82d830731359abe1bab2c9c5be13a9',
        });

        // latestCommitId does not exist in package changelog
        artifactsToLatestCommitId = {
            ESBaseCodeLWC: 'ad4d2228',
        };

        new CommitUpdater(
            latestRelease,
            artifactsToLatestCommitId,
            packagesToChangelogFilePaths,
            readPackageChangelog
        ).update();

        expect(latestRelease).toEqual({
            names: ['release-1'],
            buildNumber: 1,
            workItems: {},
            artifacts: [
                {
                    name: 'ESBaseCodeLWC',
                    from: '2dbd257',
                    to: '2dbd257',
                    version: '50.0.5.6',
                    latestCommitId: 'c8dbab13',
                    commits: [],
                },
            ],
            hashId: 'c97e09b76f82d830731359abe1bab2c9c5be13a9',
        });
    });
});
