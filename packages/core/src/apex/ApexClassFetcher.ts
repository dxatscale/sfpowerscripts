import { Connection } from "@salesforce/core";
import QueryHelper from "../queryHelper/QueryHelper";


export default class ApexClassFetcher {

  constructor(
    private conn: Connection
  ) {}

  /**
   * Query Apex Classes by Name
   *
    * @param classNames
   * @returns
   */
    public async fetchApexClassByName(
    classNames: string[],
  ): Promise<{ Id: string; Name: string; }[]> {
    let collection = classNames.map((name) => `'${name}'`).toString(); // transform into formatted string for query
    let query = `SELECT ID, Name FROM ApexClass WHERE Name IN (${collection})`;

    return QueryHelper.query<{ Id: string; Name: string; }>(query, this.conn, false);
  }
}