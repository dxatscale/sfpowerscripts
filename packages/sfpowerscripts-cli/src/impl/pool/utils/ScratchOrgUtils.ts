import { Org } from "@salesforce/core";
let request = require("request-promise-native");
import { SfdxApi } from "../sfdxnode/types";
let retry = require("async-retry");
import { isNullOrUndefined } from "util";
import SFPLogger from "@dxatscale/sfpowerscripts.core/lib/utils/SFPLogger";

const ORDER_BY_FILTER = " ORDER BY CreatedDate ASC";
export default class ScratchOrgUtils {
  public static isNewVersionCompatible: boolean = false;
  private static isVersionCompatibilityChecked: boolean = false;

  public static async checkForNewVersionCompatible(hubOrg: Org) {
    let conn = hubOrg.getConnection();
    let expectedValues = ["In Progress", "Available", "Allocate", "Assigned"];
    let availableValues: string[] = [];
    if (!this.isVersionCompatibilityChecked) {
      await retry(
        async (bail) => {
          const describeResult: any = await conn
            .sobject("ScratchOrgInfo")
            .describe();
          if (describeResult) {
            for (const field of describeResult.fields) {
              if (
                field.name === "Allocation_status__c" &&
                field.picklistValues.length === 4
              ) {
                for (let picklistValue of field.picklistValues) {
                  if (picklistValue.active) {
                    availableValues.push(picklistValue.value);
                  }
                }
                break;
              }
            }
          }
        },
        { retries: 3, minTimeout: 30000 }
      );

      this.isVersionCompatibilityChecked = true;
      //If there are values returned, its not compatible
      this.isNewVersionCompatible =
        expectedValues.filter((item) => {
          return !availableValues.includes(item);
        }).length == 0
          ? true
          : false;

      if (!this.isNewVersionCompatible) {
        SFPLogger.log(
          `Required Prerequisite values in ScratchOrgInfo.Allocation_status__c field is missing in the DevHub, expected values are : ${expectedValues}\n` +
            `Switching back to previous version, we request you to update ScratchOrgInfo.Allocation_status__c field in the DevHub \n` +
            `For more information Please refer https://github.com/Accenture/sfpowerkit/blob/main/src_saleforce_packages/scratchorgpool/force-app/main/default/objects/ScratchOrgInfo/fields/Allocation_status__c.field-meta.xml \n`
        );
      }
    }

    return this.isNewVersionCompatible;
  }

  public static async getScratchOrgLimits(hubOrg: Org, apiversion: string) {
    let conn = hubOrg.getConnection();

    var query_uri = `${conn.instanceUrl}/services/data/v${apiversion}/limits`;
    const limits = await request({
      method: "get",
      url: query_uri,
      headers: {
        Authorization: `Bearer ${conn.accessToken}`,
      },
      json: true,
    });

    return limits;
  }

  public static async getScratchOrgRecordsAsMapByUser(hubOrg: Org) {
    let conn = hubOrg.getConnection();
    let query =
      "SELECT count(id) In_Use, SignupEmail FROM ActiveScratchOrg GROUP BY SignupEmail ORDER BY count(id) DESC";
    const results = (await conn.query(query)) as any;


    let scratchOrgRecordAsMapByUser = ScratchOrgUtils.arrayToObject(
      results.records,
      "SignupEmail"
    );
    return scratchOrgRecordAsMapByUser;
  }

  private static async getScratchOrgLoginURL(
    hubOrg: Org,
    username: string
  ): Promise<any> {
    let conn = hubOrg.getConnection();

    let query = `SELECT Id, SignupUsername, LoginUrl FROM ScratchOrgInfo WHERE SignupUsername = '${username}'`;
    const results = (await conn.query(query)) as any;
    return results.records[0].LoginUrl;
  }

  public static async createScratchOrg(
    sfdx: SfdxApi,
    id: number,
    adminEmail: string,
    config_file_path: string,
    expiry: number,
    hubOrg: Org
  ): Promise<ScratchOrg> {


    let result;

    try {
      if (adminEmail) {
        result = await sfdx.force.org.create(
          {
            quiet: false,
            definitionfile: config_file_path,
            setalias: `SO${id}`,
            durationdays: expiry,
            targetdevhubusername: hubOrg.getUsername(),
            wait: 10,
          },
          `adminEmail=${adminEmail}`
        );
      } else {
        result = await sfdx.force.org.create({
          quiet: false,
          definitionfile: config_file_path,
          setalias: `SO${id}`,
          durationdays: expiry,
          targetdevhubusername: hubOrg.getUsername(),
          wait: 10,
        });
      }
    } catch (error) {
      throw new error("Unable to create scratch org");
    }


    let scratchOrg: ScratchOrg = {
      alias: `SO${id}`,
      orgId: result.orgId,
      username: result.username,
      signupEmail: adminEmail ? adminEmail : "",
    };

    //Get FrontDoor URL
    scratchOrg.loginURL = await this.getScratchOrgLoginURL(
      hubOrg,
      scratchOrg.username
    );

    return scratchOrg;
  }

  public static async getScratchOrgRecordId(
    scratchOrgs: ScratchOrg[],
    hubOrg: Org
  ) {
    if (scratchOrgs == undefined || scratchOrgs.length == 0) return;

    let hubConn = hubOrg.getConnection();

    let scratchOrgIds = scratchOrgs
      .map(function (scratchOrg) {
        scratchOrg.orgId = scratchOrg.orgId.slice(0, 15);
        return `'${scratchOrg.orgId}'`;
      })
      .join(",");

    let query = `SELECT Id, ScratchOrg FROM ScratchOrgInfo WHERE ScratchOrg IN ( ${scratchOrgIds} )`;


    return retry(
      async (bail) => {
        const results = (await hubConn.query(query)) as any;
        let resultAsObject = this.arrayToObject(results.records, "ScratchOrg");



        scratchOrgs.forEach((scratchOrg) => {
          scratchOrg.recordId = resultAsObject[scratchOrg.orgId]["Id"];
        });

        return results;
      },
      { retries: 3, minTimeout: 3000 }
    );
  }

  public static async setScratchOrgInfo(
    soInfo: any,
    hubOrg: Org
  ): Promise<boolean> {
    let hubConn = hubOrg.getConnection();

    return retry(
      async (bail) => {
        try {
          let result = await hubConn.sobject("ScratchOrgInfo").update(soInfo);
          return result.constructor !== Array ? result.success : true;
        } catch (err) {
          return false;
        }
      },
      { retries: 3, minTimeout: 3000 }
    );
  }

  public static async getScratchOrgsByTag(
    tag: string,
    hubOrg: Org,
    isMyPool: boolean,
    unAssigned: boolean
  ) {
    let hubConn = hubOrg.getConnection();

    return retry(
      async (bail) => {
        let query;

        if (!isNullOrUndefined(tag))
          query = `SELECT Pooltag__c, Id,  CreatedDate, ScratchOrg, ExpirationDate, SignupUsername, SignupEmail, Password__c, Allocation_status__c,LoginUrl FROM ScratchOrgInfo WHERE Pooltag__c = '${tag}'  AND Status = 'Active' `;
        else
          query = `SELECT Pooltag__c, Id,  CreatedDate, ScratchOrg, ExpirationDate, SignupUsername, SignupEmail, Password__c, Allocation_status__c,LoginUrl FROM ScratchOrgInfo WHERE Pooltag__c != null  AND Status = 'Active' `;

        if (isMyPool) {
          query =
            query + ` AND createdby.username = '${hubOrg.getUsername()}' `;
        }
        if (unAssigned && this.isNewVersionCompatible) {
          query = query + `AND Allocation_status__c ='Available'`;
        } else if (unAssigned && !this.isNewVersionCompatible) {
          query = query + `AND Allocation_status__c !='Assigned'`;
        }
        query = query + ORDER_BY_FILTER;
        const results = (await hubConn.query(query)) as any;
        return results;
      },
      { retries: 3, minTimeout: 3000 }
    );
  }

  public static async getActiveScratchOrgsByInfoId(
    hubOrg: Org,
    scrathOrgIds: string
  ) {
    let hubConn = hubOrg.getConnection();

    return retry(
      async (bail) => {
        let query = `SELECT Id, SignupUsername FROM ActiveScratchOrg WHERE ScratchOrgInfoId IN (${scrathOrgIds}) `;


        const results = (await hubConn.query(query)) as any;
        return results;
      },
      { retries: 3, minTimeout: 3000 }
    );
  }
  public static async getCountOfActiveScratchOrgsByTag(
    tag: string,
    hubOrg: Org
  ): Promise<number> {
    let hubConn = hubOrg.getConnection();

    return retry(
      async (bail) => {
        let query = `SELECT Id, CreatedDate, ScratchOrg, ExpirationDate, SignupUsername, SignupEmail, Password__c, Allocation_status__c,LoginUrl FROM ScratchOrgInfo WHERE Pooltag__c = '${tag}' AND Status = 'Active' `;
        const results = (await hubConn.query(query)) as any;
        return results.totalSize;
      },
      { retries: 3, minTimeout: 3000 }
    );
  }

  public static async getCountOfActiveScratchOrgsByTagAndUsername(
    tag: string,
    hubOrg: Org
  ): Promise<number> {
    let hubConn = hubOrg.getConnection();

    return retry(
      async (bail) => {
        let query = `SELECT Id, CreatedDate, ScratchOrg, ExpirationDate, SignupUsername, SignupEmail, Password__c, Allocation_status__c,LoginUrl FROM ScratchOrgInfo WHERE Pooltag__c = '${tag}' AND Status = 'Active' `;
        const results = (await hubConn.query(query)) as any;
        return results.totalSize;
      },
      { retries: 3, minTimeout: 3000 }
    );
  }

  public static async getActiveScratchOrgRecordIdGivenScratchOrg(
    hubOrg: Org,
    apiversion: string,
    scratchOrgId: string
  ): Promise<any> {
    let hubConn = hubOrg.getConnection();

    return retry(
      async (bail) => {
        var query_uri = `${hubConn.instanceUrl}/services/data/v${apiversion}/query?q=SELECT+Id+FROM+ActiveScratchOrg+WHERE+ScratchOrg+=+'${scratchOrgId}'`;

        const result = await request({
          method: "get",
          url: query_uri,
          headers: {
            Authorization: `Bearer ${hubConn.accessToken}`,
          },
          json: true,
        });

        return result.records[0].Id;
      },
      { retries: 3, minTimeout: 3000 }
    );
  }

  public static async deleteScratchOrg(
    hubOrg: Org,
    apiversion: string,
    id: string
  ) {
    let hubConn = hubOrg.getConnection();

    await retry(
      async (bail) => {
        var query_uri = `${hubConn.instanceUrl}/services/data/v${apiversion}/sobjects/ActiveScratchOrg/${id}`;
        await request({
          method: "delete",
          url: query_uri,
          headers: {
            Authorization: `Bearer ${hubConn.accessToken}`,
          },
          json: true,
        });
      },
      { retries: 3, minTimeout: 3000 }
    );
  }

  private static arrayToObject = (array, keyfield) =>
    array.reduce((obj, item) => {
      obj[item[keyfield]] = item;
      return obj;
    }, {});

  public static async checkForPreRequisite(hubOrg: Org) {
    let hubConn = hubOrg.getConnection();

    return retry(
      async (bail) => {
        const results: any = await hubConn.metadata.read(
          "CustomObject",
          "ScratchOrgInfo"
        );

        const checker = (element) =>
          element.fullName === "Allocation_status__c";
        if (results["fields"].some(checker)) {
          return true;
        } else {
          return false;
        }
      },
      { retries: 3, minTimeout: 2000 }
    );
  }
}

export interface ScratchOrg {
  tag?: string;
  recordId?: string;
  orgId?: string;
  loginURL?: string;
  signupEmail?: string;
  username?: string;
  alias?: string;
  password?: string;
  isScriptExecuted?: boolean;
  expityDate?: string;
  accessToken?: string;
  instanceURL?: string;
  status?: string;
  failureMessage?: string;
}
