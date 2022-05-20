import { Connection } from '@salesforce/core';
import chunkCollection from '../../queryHelper/ChunkCollection';
import QueryHelper from '../../queryHelper/QueryHelper';

export default class ApexCodeCoverageAggregateFetcher {
    constructor(private conn: Connection) {}

    /**
     * Query ApexCodeCoverageAggregate by list of ApexClassorTriggerId
     * @param listOfApexClassOrTriggerId
     * @returns
     */
    public async fetchACCAById(listOfApexClassOrTriggerId: string[]): Promise<{
        ApexClassOrTriggerId: string;
        NumLinesCovered: number;
        NumLinesUncovered: number;
        Coverage: any;
    }[]> {
        let result: {
            ApexClassOrTriggerId: string;
            NumLinesCovered: number;
            NumLinesUncovered: number;
            Coverage: any;
        }[] = [];

        const chunks = chunkCollection(listOfApexClassOrTriggerId);
        for (const chunk of chunks) {
            const formattedChunk = chunk.map(elem => `'${elem}'`).toString();
            let query = `SELECT ApexClassorTriggerId, NumLinesCovered, NumLinesUncovered, Coverage FROM ApexCodeCoverageAggregate WHERE ApexClassorTriggerId IN (${formattedChunk})`;

            const records = await QueryHelper.query<{
                ApexClassOrTriggerId: string;
                NumLinesCovered: number;
                NumLinesUncovered: number;
                Coverage: any;
            }>(query, this.conn, true);
            result = result.concat(records);
        }

        return result;
    }
}
