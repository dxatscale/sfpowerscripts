import { Connection } from "@salesforce/core";
import QueryHelper from "../query/QueryHelper";
const retry = require("async-retry");

/*
 * Retrieve Permsets for a user from a target org
 */
export default class PermissionSetFetcher {

  constructor(private username: string, private conn: Connection) {}

  public async fetchAllPermsetAssignment() {

    const query = `SELECT Id, PermissionSet.Name, Assignee.Username FROM PermissionSetAssignment WHERE Assignee.Username = '${this.username}'`;

    return await QueryHelper.query<any>(query, this.conn, false);
  }
}
