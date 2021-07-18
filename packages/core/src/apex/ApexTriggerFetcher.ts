import { Connection } from "@salesforce/core";
import QueryHelper from "../queryHelper/QueryHelper";


export default class ApexTriggerFetcher {

  constructor(
    private conn: Connection
  ) {}

  /**
   * Query Triggers by Name
   *
   * @param triggerNames
   * @returns
   */
  public async fetchApexTriggerByName(
    triggerNames: string[]
  ): Promise<{ Id: string; Name: string; }[]> {

    let collection = triggerNames.map((name) => `'${name}'`).toString(); // transform into formatted string for query
    let query = `SELECT ID, Name FROM ApexTrigger WHERE Name IN (${collection})`;

    return QueryHelper.query<{ Id: string; Name: string; }>(query, this.conn, false);
  }
}