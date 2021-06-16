import { Org } from "@salesforce/core";
let retry = require("async-retry");

export default class DeleteScratchOrg {
  constructor(private hubOrg: Org) {}

  public async deleteScratchOrg(scratchOrgIds: string[]) {
    let hubConn = this.hubOrg.getConnection();

    await retry(
      async (bail) => {
        await hubConn.sobject("ActiveScratchOrg").del(scratchOrgIds);
      },
      { retries: 3, minTimeout: 3000 }
    );
  }
}
