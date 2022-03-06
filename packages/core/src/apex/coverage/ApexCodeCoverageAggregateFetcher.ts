import { Connection } from '@salesforce/core';
import QueryHelper from '../../queryHelper/QueryHelper';

export default class ApexCodeCoverageAggregateFetcher {
    constructor(private conn: Connection) {}

    /**
     * Query ApexCodeCoverageAggregate by list of ApexClassorTriggerId
     * @param listOfApexClassOrTriggerId
     * @returns
     */
    public async fetchACCAById(listOfApexClassOrTriggerId: string[]) {
        let collection = listOfApexClassOrTriggerId
            .map((ApexClassOrTriggerId) => `'${ApexClassOrTriggerId}'`)
            .toString();
        let query = `SELECT ApexClassorTriggerId, NumLinesCovered, NumLinesUncovered, Coverage FROM ApexCodeCoverageAggregate WHERE ApexClassorTriggerId IN (${collection})`;

        return QueryHelper.query<{
            ApexClassOrTriggerId: string;
            NumLinesCovered: number;
            NumLinesUncovered: number;
            Coverage: any;
        }>(query, this.conn, true);
    }
}
