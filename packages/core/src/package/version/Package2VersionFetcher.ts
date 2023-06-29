import { Connection } from '@salesforce/core';
import QueryHelper from '../../queryHelper/QueryHelper';
import semver from 'semver';

/**
 * Fetcher for second-generation package version in Dev Hub
 */
export default class Package2VersionFetcher {
    private readonly query: string =
        'Select SubscriberPackageVersionId, Package2Id, Package2.Name, IsPasswordProtected, IsReleased, MajorVersion, MinorVersion, PatchVersion, BuildNumber, CodeCoverage, HasPassedCodeCoverageCheck, Branch from Package2Version ';

    constructor(private conn: Connection) {}

    /**
     * Fetch Package2 versions by Package2 Id
     * Sorts by semantic version, in descending order
     * @param package2Id
     * @param versionNumber
     * @param isValidatedPackages
     * @returns
     */
    async fetchByPackage2Id(
        package2Id: string,
        versionNumber?: string,
        isValidatedPackages?: boolean
    ): Promise<Package2Version[]> {
        let query = this.query;

        let whereClause: string = `where Package2Id='${package2Id}'  `;

        if (versionNumber) {
            // TODO: validate version number
            const versions = versionNumber.split('.');

            if (versions[0]) whereClause += `and MajorVersion=${versions[0]} `;
            if (versions[1]) whereClause += `and MinorVersion=${versions[1]} `;
            if (versions[2]) whereClause += `and PatchVersion=${versions[2]} `;
            if (versions[3]) whereClause += `and BuildNumber=${versions[3]} `;
        }

        if (isValidatedPackages) whereClause += `and ValidationSkipped = false `;

        whereClause += `and IsDeprecated = false `;
        query += whereClause;


        const records = await QueryHelper.query<Package2Version>(query, this.conn, true);

       
        if (records.length > 1) {
            return records.sort((a, b) => {
                const v1 = `${a.MajorVersion}.${a.MinorVersion}.${a.PatchVersion}-${a.BuildNumber}`;
                const v2 = `${b.MajorVersion}.${b.MinorVersion}.${b.PatchVersion}-${b.BuildNumber}`;
                return semver.rcompare(v1, v2);
            });
        } else return records;
    }

    async fetchBySubscriberPackageVersionId(subscriberPackageVersionId: string): Promise<Package2Version> {
        let query = this.query;

        let whereClause: string = `where SubscriberPackageVersionId='${subscriberPackageVersionId}'`;
        query += whereClause;

        const records = await QueryHelper.query<Package2Version>(query, this.conn, true);
        return records[0];
    }

    async fetchByPackageBranchAndName(
        packageBranch: string, 
        packageName: string, 
        versionNumber?: string,
        ): Promise<Package2Version[]> {
            
        let query = this.query;

        let whereClause: string = `where Branch='${packageBranch}' and Package2.Name ='${packageName}' `;
        if (versionNumber) {
            // TODO: validate version number
            const versions = versionNumber.split('.');
            if (versions[0]) whereClause += `and MajorVersion=${versions[0]} `;
            if (versions[1]) whereClause += `and MinorVersion=${versions[1]} `;
            if (versions[2]) whereClause += `and PatchVersion=${versions[2]} `;
        }
        query += whereClause;

        let orderByClause: string = `order by CreatedDate desc`;
        query += orderByClause;

        const records = await QueryHelper.query<Package2Version>(query, this.conn, true);
        return records;

    }        
}

export interface Package2Version {
    SubscriberPackageVersionId: string;
    Package2Id: string;
    Package2: { Name: string };
    IsPasswordProtected: boolean;
    IsReleased: boolean;
    MajorVersion: number;
    MinorVersion: number;
    PatchVersion: number;
    BuildNumber: number;
    CodeCoverage: { apexCodeCoveragePercentage: number };
    HasPassedCodeCoverageCheck: boolean;
    Branch: string;
}
