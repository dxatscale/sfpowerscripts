import { LoggerLevel, Org } from "@salesforce/core";
let retry = require("async-retry");
import SFPLogger from "@dxatscale/sfpowerscripts.core/lib/logger/SFPLogger";


export default class ScratchOrgInfoAssigner {

  constructor(private hubOrg: Org) {}

  public async setScratchOrgInfo(
    soInfo: any
  ): Promise<boolean> {
    let hubConn = this.hubOrg.getConnection();

    return  retry(
      async (bail) => {
        try {
          let result = await hubConn.sobject("ScratchOrgInfo").update(soInfo);
          SFPLogger.log(
            "Setting Scratch Org Info:" + JSON.stringify(result),
            LoggerLevel.TRACE
          );
          return result.constructor !== Array ? result.success : true;
        } catch (err) {
          SFPLogger.log(
            "Failure at setting ScratchOrg Info" + err,
            LoggerLevel.TRACE
          );
          return false;
        }
      },
      { retries: 3, minTimeout: 3000 }
    );
  }

 



}

