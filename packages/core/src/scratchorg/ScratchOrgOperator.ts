
import { Aliases, AuthInfo, Org, ScratchOrgRequest } from "@salesforce/core";
import ScratchOrg from "./ScratchOrg";
import PasswordGenerator from "./PasswordGenerator";
import SFPLogger, { LoggerLevel } from "../logger/SFPLogger";
import { Duration } from '@salesforce/kit';
const retry = require("async-retry");


export default class ScratchOrgOperator {
  constructor(private hubOrg: Org) {}

  public async create(
   alias:string,
    config_file_path: string,
    expiry: number
  ): Promise<ScratchOrg> {
    SFPLogger.log(
      "Parameters: " +
        alias +
        " " +
        config_file_path +
        " " +
        expiry +
        " ",
      LoggerLevel.TRACE
    );

    let scatchOrgResult=await this.requestAScratchOrg(alias,config_file_path,Duration.days(expiry));
    SFPLogger.log(JSON.stringify(scatchOrgResult), LoggerLevel.TRACE);

    //create scratchOrg object
    let scratchOrg: ScratchOrg = {
      alias: alias,
      orgId: scatchOrgResult.orgId,
      username: scatchOrgResult.username,
      loginURL:scatchOrgResult.loginURL,
    };


    try
    {
    //Get Sfdx Auth URL
    const authInfo = await AuthInfo.create({ username: scratchOrg.username });
    scratchOrg.sfdxAuthUrl = authInfo.getSfdxAuthUrl();
    }
    catch(error)
    {
      throw new Error(`Unable to set auth URL, Ignoring this scratch org, as its not suitable for pool due to ${error.message}`);
    }


    //Generate Password
    let passwordData = await new PasswordGenerator().exec(
      scratchOrg.username
    );

    scratchOrg.password = passwordData.password;



    if (!passwordData.password) {
      throw new Error("Unable to setup password to scratch org");
    } else {
      SFPLogger.log(
        `Password successfully set for ${passwordData.username}`,
        LoggerLevel.INFO
      );
    }

    return scratchOrg;
  }

  public async delete(scratchOrgIds: string[]) {
    let hubConn = this.hubOrg.getConnection();

    await retry(
      async (bail) => {
        await hubConn.sobject("ActiveScratchOrg").del(scratchOrgIds);
      },
      { retries: 3, minTimeout: 3000 }
    );
  }
  
  private async requestAScratchOrg(alias:string,definitionFile:string,expireIn:Duration)
  {
    const createCommandOptions: ScratchOrgRequest = {
      durationDays: expireIn.days,
      nonamespace: false,
      noancestors: false,
      wait: Duration.minutes(6),
      retry: 3,
      definitionfile: definitionFile
    };

    const { username, scratchOrgInfo, authFields, warnings } = await this.hubOrg.scratchOrgCreate(createCommandOptions);

    await this.setAliasForUsername(username,alias);

    return {
      'username':username,
      'loginURL':scratchOrgInfo.LoginUrl,
      warnings,
      orgId: authFields.orgId,
    };
  }

  private async setAliasForUsername(username: string,aliasToSet:string): Promise<void> {
      const alias = await Aliases.create(Aliases.getDefaultOptions());
      alias.set(aliasToSet, username);
      const result = await alias.write();
  }


}
