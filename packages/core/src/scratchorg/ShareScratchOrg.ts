import { LoggerLevel, Org } from "@salesforce/core";
import SFPLogger from "../logger/SFPLogger";
import ScratchOrg from "./ScratchOrg";

let retry = require("async-retry");

export default class ShareScratchOrg {
  constructor(private hubOrg: Org, private scratchOrg: ScratchOrg) {}

  public async shareScratchOrgThroughEmail(emailId: string) {
    let hubOrgUserName = this.hubOrg.getUsername();
    let apiVersion = this.hubOrg.getConnection().retrieveMaxApiVersion();
    let body = `${hubOrgUserName} has fetched a new scratch org from the Scratch Org Pool!\n
   All the post scratch org scripts have been succesfully completed in this org!\n
   The Login url for this org is : ${this.scratchOrg.loginURL}\n
   Username: ${this.scratchOrg.username}\n
   Password: ${this.scratchOrg.password}\n
   Please use sfdx force:auth:web:login -r ${this.scratchOrg.loginURL} -a <alias>  command to authenticate against this Scratch org</p>
   Thank you for using SFPLogger!`;

    const options = {
      method: "post",
      body: JSON.stringify({
        inputs: [
          {
            emailBody: body,
            emailAddresses: emailId,
            emailSubject: `${hubOrgUserName} created you a new Salesforce org`,
            senderType: "CurrentUser",
          },
        ],
      }),
      url: `/services/data/v${apiVersion}actions/standard/emailSimple`,
    };

    await retry(
      async (bail) => {
        await this.hubOrg.getConnection().request(options);
      },
      { retries: 3, minTimeout: 30000 }
    );

    SFPLogger.log(
      `Succesfully send email to ${emailId} for ${this.scratchOrg.username}`,
      LoggerLevel.INFO
    );
  }
}
