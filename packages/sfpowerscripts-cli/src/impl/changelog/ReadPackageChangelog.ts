
import { Changelog as PackageChangelog } from "@dxatscale/sfpowerscripts.core/lib/changelog/interfaces/GenericChangelogInterfaces";

export default interface ReadPackageChangelog {
  (changelogFilePath: string): PackageChangelog;
}
