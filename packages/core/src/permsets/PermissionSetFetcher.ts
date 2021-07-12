import { Connection } from "@salesforce/core";
const retry = require("async-retry");

/*
 * Retrieve Permsets for a user from a target org
 */
export default class PermissionSetFetcher {
  constructor(private username: string, private conn: Connection) {}
  public async fetchAllPermsetAssignment() {


    return retry(
      async (bail) => {
        //Find all permsets assigned to this user
        let query = `SELECT Id, PermissionSet.Name, Assignee.Username FROM PermissionSetAssignment WHERE Assignee.Username = '${this.username}'`;
        const result = await this.conn.query(query);
        return result.records
      },
      { retries: 3, minTimeout: 3000 }
    );
  }
}
