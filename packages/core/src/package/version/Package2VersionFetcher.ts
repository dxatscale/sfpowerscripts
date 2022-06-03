import { Connection } from '@salesforce/core';
import QueryHelper from '../../queryHelper/QueryHelper';

/**
 * TODO: caching
 * TODO: optimised query
 * Fetcher for second-generation package version in Dev Hub
 */
export default class Package2VersionFetcher {

    private readonly query: string =
      'Select SubscriberPackageVersionId, Package2Id, Package2.Name, IsPasswordProtected, IsReleased, MajorVersion, MinorVersion, PatchVersion, BuildNumber, CodeCoverage, HasPassedCodeCoverageCheck from Package2Version ';

    constructor(private conn: Connection) {}

    fetch(package2Id?: string, versionNumber?: string, isValidatedPackages?: boolean): Promise<Package2Version[]> {
      let query = this.query;

      let whereClause: string = `where `;
      if (package2Id) {
        whereClause += `Package2Id='${package2Id}' `;
      }

      if (versionNumber) {
        // TODO: validate version number
        const versions = versionNumber.split(".");

        if (versions[0]) whereClause += `and MajorVersion=${versions[0]} `;
        if (versions[1]) whereClause += `and MinorVersion=${versions[1]} `;
        if (versions[2]) whereClause += `and PatchVersion=${versions[2]} `;
        if (versions[3]) whereClause += `and BuildNumber=${versions[3]} `;
      }

      if (isValidatedPackages) whereClause += `and ValidationSkipped = false `;

      const isWhereClauseEmpty = whereClause.endsWith("where ");
      if (!isWhereClauseEmpty) {
        query += whereClause
      }

      query += 'ORDER BY BuildNumber DESC, createddate DESC';

      return QueryHelper.query<Package2Version>(query, this.conn, true);
    }

    fetchBySubscriberPackageVersionId(subscriberPackageVersionId: string): Promise<Package2Version[]> {
      let query = this.query;

      let whereClause: string = `where SubscriberPackageVersionId='${subscriberPackageVersionId}'`;
      query += whereClause;

      return QueryHelper.query<Package2Version>(query, this.conn, true);
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
  HasPassedCodeCoverageCheck: boolean
}

//             // If Build Number isn't set to LATEST, look for the exact Package Version
//             if (vers.length === 4 && vers[3] !== 'LATEST' && typeof vers[3] === 'number') {
//               query += `and BuildNumber=${vers[3]} `;
//           } else if (ignoreUnvalidatedPackageVersions) {
//               query += `and ValidationSkipped = false `;
//           }

//           query += 'ORDER BY BuildNumber DESC, createddate DESC';