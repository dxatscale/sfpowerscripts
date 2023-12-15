import { Changelog as PackageChangelog } from '../../core/changelog/interfaces/GenericChangelogInterfaces';

export default interface ReadPackageChangelog {
    (changelogFilePath: string): PackageChangelog;
}
