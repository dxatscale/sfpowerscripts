import SFPLogger, {
  LoggerLevel,
} from "@dxatscale/sfpowerscripts.core/lib/logger/SFPLogger";
import { Org } from "@salesforce/core";
let request = require("request-promise-native");

export default class ScratchOrgLimitsFetcher {
  constructor(private hubOrg: Org) {}

  public async getScratchOrgLimits() {
    let conn = this.hubOrg.getConnection();
    let apiVersion = conn.retrieveMaxApiVersion();
    var query_uri = `${conn.instanceUrl}/services/data/v${apiVersion}/limits`;
    const limits = await request({
      method: "get",
      url: query_uri,
      headers: {
        Authorization: `Bearer ${conn.accessToken}`,
      },
      json: true,
    });

    SFPLogger.log(
      `Limits Fetched: ${JSON.stringify(limits)}`,
      null,
      LoggerLevel.TRACE
    );
    return limits;
  }
}
