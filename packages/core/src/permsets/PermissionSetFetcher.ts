import { Connection } from '@salesforce/core';
import QueryHelper from '../queryHelper/QueryHelper';

/*
 * Retrieve Permsets for a user from a target org
 */
export default class PermissionSetFetcher {
    constructor(private username: string, private conn: Connection) {}

    public async fetchAllPermsetAssignment() {
        const query = `SELECT Id, PermissionSet.Name, Assignee.Username FROM PermissionSetAssignment WHERE Assignee.Username = '${this.username}'`;

        return QueryHelper.query<any>(query, this.conn, false);
    }
}
