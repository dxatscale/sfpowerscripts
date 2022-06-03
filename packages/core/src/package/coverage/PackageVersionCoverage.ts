import { Connection } from '@salesforce/core';
import SFPLogger, { Logger, LoggerLevel } from '../../logger/SFPLogger';
import Package2VersionFetcher from '../version/Package2VersionFetcher';

export default class PackageVersionCoverage {
    public constructor(private connection: Connection, private logger: Logger) {}

    public async getCoverage(versionId: string): Promise<PackageCoverage> {
        const package2VersionFetcher = new Package2VersionFetcher(this.connection);
        const records = await package2VersionFetcher.fetchBySubscriberPackageVersionId(versionId);
        SFPLogger.log(`Fetched Records ${JSON.stringify(records)}`, LoggerLevel.TRACE, this.logger);
        if (records[0]) {
            var packageCoverage = <PackageCoverage>{};
            packageCoverage.HasPassedCodeCoverageCheck = records[0].HasPassedCodeCoverageCheck;
            packageCoverage.coverage = records[0].CodeCoverage ? records[0].CodeCoverage.apexCodeCoveragePercentage : 0;
            packageCoverage.packageId = records[0].Package2Id;
            packageCoverage.packageName = records[0].Package2.Name;
            packageCoverage.packageVersionId = records[0].SubscriberPackageVersionId;
            packageCoverage.packageVersionNumber = `${records[0].MajorVersion}.${records[0].MinorVersion}.${records[0].PatchVersion}.${records[0].BuildNumber}`;

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
