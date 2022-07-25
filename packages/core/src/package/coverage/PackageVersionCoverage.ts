import { Connection } from '@salesforce/core';
import SFPLogger, { Logger, LoggerLevel } from '@dxatscale/sfp-logger';
import Package2VersionFetcher from '../version/Package2VersionFetcher';

export default class PackageVersionCoverage {
    public constructor(private connection: Connection, private logger: Logger) {}

    public async getCoverage(versionId: string): Promise<PackageCoverage> {
        const package2VersionFetcher = new Package2VersionFetcher(this.connection);
        const package2Version = await package2VersionFetcher.fetchBySubscriberPackageVersionId(versionId);
        SFPLogger.log(`Fetched Record ${JSON.stringify(package2Version)}`, LoggerLevel.TRACE, this.logger);
        if (package2Version) {
            var packageCoverage = <PackageCoverage>{};
            packageCoverage.HasPassedCodeCoverageCheck = package2Version.HasPassedCodeCoverageCheck;
            packageCoverage.coverage = package2Version.CodeCoverage ? package2Version.CodeCoverage.apexCodeCoveragePercentage : 0;
            packageCoverage.packageId = package2Version.Package2Id;
            packageCoverage.packageName = package2Version.Package2.Name;
            packageCoverage.packageVersionId = package2Version.SubscriberPackageVersionId;
            packageCoverage.packageVersionNumber = `${package2Version.MajorVersion}.${package2Version.MinorVersion}.${package2Version.PatchVersion}.${package2Version.BuildNumber}`;

            SFPLogger.log(
                `Successfully Retrieved the Apex Test Coverage of the package version`,
                LoggerLevel.INFO,
                this.logger
            );
        } else {
            throw new Error(`Package version doesnot exist, Please check the version details`);
        }
        return packageCoverage;
    }
}
interface PackageCoverage {
    coverage: number;
    packageName: string;
    packageId: string;
    packageVersionNumber: string;
    packageVersionId: string;
    HasPassedCodeCoverageCheck: boolean;
}
