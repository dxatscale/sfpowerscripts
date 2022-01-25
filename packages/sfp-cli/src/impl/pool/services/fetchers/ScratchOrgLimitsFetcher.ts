import { Org } from "@salesforce/core";


export default class ScratchOrgLimitsFetcher {
  constructor(private hubOrg: Org) {}

  public async getScratchOrgLimits():Promise<any>{
    let conn = this.hubOrg.getConnection();
    let apiVersion = await conn.retrieveMaxApiVersion();
    let query_uri = `${conn.instanceUrl}/services/data/v${apiVersion}/limits`;
    const result = await conn.request(query_uri);
    return result;
  }
}
