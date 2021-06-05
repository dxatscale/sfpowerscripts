import SFPLogger, {
  LoggerLevel,
} from "@dxatscale/sfpowerscripts.core/lib/logger/SFPLogger";
import CreateScratchOrgImpl from "@dxatscale/sfpowerscripts.core/lib/sfdxwrappers/CreateScratchOrgImpl";
import { AuthInfo, Org } from "@salesforce/core";
import ScratchOrg from "../ScratchOrg";
import PasswordGenerator from "./PasswordGenerator";

export default class CreateScratchOrg {
  constructor(private hubOrg: Org) {}

  public async createScratchOrg(
    id: number,
    adminEmail: string,
    config_file_path: string,
    expiry: number
  ): Promise<ScratchOrg> {
    SFPLogger.log(
      "Parameters: " +
        id +
        " " +
        adminEmail +
        " " +
        config_file_path +
        " " +
        expiry +
        " ",
      null,
      null,
      LoggerLevel.TRACE
    );

    let result;

    try {
      let createScratchOrgImpl: CreateScratchOrgImpl = new CreateScratchOrgImpl(
        null,
        config_file_path,
        this.hubOrg.getUsername(),
        `SO${id}`,
        expiry,
        adminEmail
      );
      result = await createScratchOrgImpl.exec(true);
    } catch (error) {
      //Poolcreateimpl to handle
      throw error;
    }

    SFPLogger.log(JSON.stringify(result), null, null,LoggerLevel.TRACE);

    let scratchOrg: ScratchOrg = {
      alias: `SO${id}`,
      orgId: result.orgId,
      username: result.username,
      signupEmail: adminEmail ? adminEmail : "",
    };

    //Get FrontDoor URL
    scratchOrg.loginURL = await this.getScratchOrgLoginURL(scratchOrg.username);


    //Generate Password
    let passwordData = await new PasswordGenerator().exec(
      scratchOrg.username
    );

    scratchOrg.password = passwordData.password;

    //Get Sfdx Auth URL
    const authInfo = await AuthInfo.create({ username: scratchOrg.username });

    scratchOrg.sfdxAuthUrl = authInfo.getSfdxAuthUrl();

    if (!passwordData.password) {
      throw new Error("Unable to setup password to scratch org");
    } else {
      SFPLogger.log(
        `Password successfully set for ${passwordData.username}`,
        null,
        null,
        LoggerLevel.INFO
      );
    }

    return scratchOrg;
  }

  private async getScratchOrgLoginURL(username: string): Promise<any> {
    let conn = this.hubOrg.getConnection();

    let query = `SELECT Id, SignupUsername, LoginUrl FROM ScratchOrgInfo WHERE SignupUsername = '${username}'`;
    SFPLogger.log("QUERY:" + query, null,null, LoggerLevel.TRACE);
    const results = (await conn.query(query)) as any;
    SFPLogger.log(
      `Login URL Fetched: ${JSON.stringify(results)}`,
      null,
      null,
      LoggerLevel.TRACE
    );

    return results.records[0].LoginUrl;
  }
}
