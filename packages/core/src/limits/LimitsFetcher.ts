import { Connection } from "@salesforce/core";
const retry = require("async-retry");


export default class LimitsFetcher {

  constructor(
    private conn: Connection
  ) {}

  public async getApiLimits() {
    const limits: {name: string; max: number; remaining: number}[] = [];
    const endpoint = `${this.conn.instanceUrl}/services/data/v${this.conn.version}/limits`;

    const result = await retry(
      async (bail) => {
        return this.conn.request<{
          [p: string]: { Max: number; Remaining: number };
        }>(endpoint);
      },
      { retries: 3, minTimeout: 2000 }
    );

    Object.keys(result).forEach((limitName) => {
      limits.push({
        name: limitName,
        max: result[limitName].Max,
        remaining: result[limitName].Remaining,
      });
    });


    return limits;
  }
}