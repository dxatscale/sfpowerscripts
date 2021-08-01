import { Org, sfdc } from "@salesforce/core";
import QueryHelper from "../queryHelper/QueryHelper";

export default class ScratchOrgInfoFetcher {
  constructor(
    private hubOrg: Org
  ){}

  public async getScratchOrgInfoByOrgId(orgId: string[]) {
    const conn = this.hubOrg.getConnection();

    let collection = orgId
      .map((id) => {
        return `'${sfdc.trimTo15(id)}'`;
      })
      .toString();


    let query = `
      SELECT Id, ScratchOrg, Status
      FROM ScratchOrgInfo
      WHERE ScratchOrg IN (${collection})
    `;

    return  QueryHelper.query<ScratchOrgInfo>(query, conn, false);
  }
}

export interface ScratchOrgInfo {
  Id: string,
  ScratchOrg: string;
  Status: "New" | "Deleted" | "Active" | "Error"
}
