import { Connection } from '@salesforce/core';
import chunkCollection from "../queryHelper/ChunkCollection";
import QueryHelper from '../queryHelper/QueryHelper';

export default class ApexClassFetcher {
    constructor(private conn: Connection) {}

    /**
     * Query Apex Classes by Name
     *
     * @param classNames
     * @returns
     */
    public async fetchApexClassByName(classNames: string[]): Promise<{ Id: string; Name: string }[]> {
        let result: {Id: string; Name: string}[] = [];

        const chunks = chunkCollection(classNames);
        for (const chunk of chunks) {
            const formattedChunk = chunk.map(elem => `'${elem}'`).toString(); // transform into formatted string for query
            const query = `SELECT ID, Name FROM ApexClass WHERE Name IN (${formattedChunk})`;

            const records = await QueryHelper.query<{ Id: string; Name: string }>(query, this.conn, false);
            result = result.concat(records);
        }

        return result;
    }
}