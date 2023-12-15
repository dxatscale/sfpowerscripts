import { Connection } from '@salesforce/core';
import QueryHelper from '../queryHelper/QueryHelper';

export default class OrganizationFetcher {
    constructor(private conn: Connection) {}

    public fetch() {
        const query = 'SELECT OrganizationType, IsSandbox FROM Organization LIMIT 1';

        return QueryHelper.query<{ OrganizationType: string; IsSandbox: boolean }>(query, this.conn, false);
    }
}
