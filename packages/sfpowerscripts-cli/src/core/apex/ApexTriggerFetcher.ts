import { Connection } from '@salesforce/core';
import chunkCollection from '../queryHelper/ChunkCollection';
import QueryHelper from '../queryHelper/QueryHelper';

export default class ApexTriggerFetcher {
    constructor(private conn: Connection) {}

    /**
     * Query Triggers by Name
     *
     * @param triggerNames
     * @returns
     */
    public async fetchApexTriggerByName(triggerNames: string[]): Promise<{ Id: string; Name: string }[]> {
        let result: {Id: string, Name: string}[] = [];

        const chunks = chunkCollection(triggerNames);
        for (const chunk of chunks) {
            const formattedChunk = chunk.map(elem => `'${elem}'`).toString(); // transform into formatted string for query
            const query = `SELECT ID, Name FROM ApexTrigger WHERE Name IN (${formattedChunk})`;

            const records = await QueryHelper.query<{ Id: string; Name: string }>(query, this.conn, false);
            result = result.concat(records);
        }

        return result;
    }
}
