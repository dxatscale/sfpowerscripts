import { Connection } from "@salesforce/core";
const retry = require("async-retry");



export default class QueryHelper {


  static async query(query: string, conn: Connection, isTooling: boolean) {
    return retry(
      async (bail) => {
        let records;
        if (isTooling)
          records = (await conn.tooling.query<any>(query)).records;
        else
          records = (await conn.query<any>(query)).records;

        return records;
      },
      { retries: 3, minTimeout: 2000 }
    );
  }
}