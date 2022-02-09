
import SFPLogger, { LoggerLevel } from "@dxatscale/sfpowerscripts.core/lib/logger/SFPLogger";
import { Org } from "@salesforce/core";
import ScratchOrg from "@dxatscale/sfpowerscripts.core/lib/scratchorg/ScratchOrg";
const retry = require("async-retry");
const ORDER_BY_FILTER = " ORDER BY CreatedDate ASC";

export default class ScratchOrgInfoFetcher {

  constructor(private hubOrg: Org) {}

  public async getScratchOrgRecordId(scratchOrgs: ScratchOrg[]) {
    if (scratchOrgs == undefined || scratchOrgs.length == 0) return;

    let hubConn = this.hubOrg.getConnection();

    let scratchOrgIds = scratchOrgs
      .map(function (scratchOrg) {
        scratchOrg.orgId = scratchOrg.orgId.slice(0, 15);
        return `'${scratchOrg.orgId}'`;
      })
      .join(",");

    let query = `SELECT Id, ScratchOrg FROM ScratchOrgInfo WHERE ScratchOrg IN ( ${scratchOrgIds} )`;
    SFPLogger.log("QUERY:" + query, LoggerLevel.TRACE);

    return  retry(
      async (bail) => {
        const results = (await hubConn.query(query)) as any;
        let resultAsObject = this.arrayToObject(results.records, "ScratchOrg");

        SFPLogger.log(JSON.stringify(resultAsObject),LoggerLevel.TRACE);

        scratchOrgs.forEach((scratchOrg) => {
          scratchOrg.recordId = resultAsObject[scratchOrg.orgId]["Id"];
        });

        return scratchOrgs;
      },
      { retries: 3, minTimeout: 3000 }
    );
  }

  public async getScratchOrgsByTag(
    tag: string,
    isMyPool: boolean,
    unAssigned: boolean
  ) {
    let hubConn = this.hubOrg.getConnection();

    return  retry(
      async (bail) => {
        let query;

        if (tag)
          query = `SELECT Pooltag__c, Id,  CreatedDate, ScratchOrg, ExpirationDate, SignupUsername, SignupEmail, Password__c, Allocation_status__c,LoginUrl,SfdxAuthUrl__c FROM ScratchOrgInfo WHERE Pooltag__c = '${tag}'  AND Status = 'Active' `;
        else
          query = `SELECT Pooltag__c, Id,  CreatedDate, ScratchOrg, ExpirationDate, SignupUsername, SignupEmail, Password__c, Allocation_status__c,LoginUrl,SfdxAuthUrl__c FROM ScratchOrgInfo WHERE Pooltag__c != null  AND Status = 'Active' `;

        if (isMyPool) {
          query =
            query + ` AND createdby.username = '${this.hubOrg.getUsername()}' `;
        }
        if (unAssigned) {
          // if new version compatible get Available / In progress
          query =
            query +
            `AND ( Allocation_status__c ='Available' OR Allocation_status__c = 'In Progress' ) `;
        }
        query = query + ORDER_BY_FILTER;
        SFPLogger.log("QUERY:" + query, LoggerLevel.TRACE);
        const results = (await hubConn.query(query)) as any;
        return results;
      },
      { retries: 3, minTimeout: 3000 }
    );
  }

  public async getActiveScratchOrgsByInfoId(scrathOrgIds: string) {
    let hubConn = this.hubOrg.getConnection();

    return  retry(
      async (bail) => {
        let query = `SELECT Id, SignupUsername FROM ActiveScratchOrg WHERE ScratchOrgInfoId IN (${scrathOrgIds}) `;

        SFPLogger.log("QUERY:" + query,LoggerLevel.TRACE);
        const results = (await hubConn.query(query)) as any;
        return results;
      },
      { retries: 3, minTimeout: 3000 }
    );
  }

  public async getCountOfActiveScratchOrgsByTag(tag: string): Promise<number> {
    let hubConn = this.hubOrg.getConnection();

    return  retry(
      async (bail) => {
        let query = `SELECT Id, CreatedDate, ScratchOrg, ExpirationDate, SignupUsername, SignupEmail, Password__c, Allocation_status__c,LoginUrl FROM ScratchOrgInfo WHERE Pooltag__c = '${tag}' AND Status = 'Active' `;
        SFPLogger.log("QUERY:" + query,LoggerLevel.TRACE);
        const results = (await hubConn.query(query)) as any;
        SFPLogger.log(
          "RESULT:" + JSON.stringify(results),
          LoggerLevel.TRACE
        );
        return results.totalSize;
      },
      { retries: 3, minTimeout: 3000 }
    );
  }

  public async getCountOfActiveScratchOrgsByTagAndUsername(
    tag: string
  ): Promise<number> {
    let hubConn = this.hubOrg.getConnection();

    return  retry(
      async (bail) => {
        let query = `SELECT Id, CreatedDate, ScratchOrg, ExpirationDate, SignupUsername, SignupEmail, Password__c, Allocation_status__c,LoginUrl FROM ScratchOrgInfo WHERE Pooltag__c = '${tag}' AND Status = 'Active' `;
        SFPLogger.log("QUERY:" + query,LoggerLevel.TRACE);
        const results = (await hubConn.query(query)) as any;
        return results.totalSize;
      },
      { retries: 3, minTimeout: 3000 }
    );
  }

  public async getActiveScratchOrgRecordIdGivenScratchOrg(
    scratchOrgId: string
  ): Promise<any> {
    let hubConn = this.hubOrg.getConnection();
    return  retry(
      async (bail) => {
        let query = `SELECT Id FROM ActiveScratchOrg WHERE ScratchOrg = '${scratchOrgId}'`;
        let records = (await hubConn.query<any>(query)).records;

        SFPLogger.log(
          "Retrieve Active ScratchOrg Id:" + JSON.stringify(records),
          LoggerLevel.TRACE
        );
        return records[0].Id;
      },
      { retries: 3, minTimeout: 3000 }
    );
  }

  public async getActiveScratchOrgRecordsAsMapByUser(hubOrg: Org) {
    let conn = this.hubOrg.getConnection();
    let query =
      "SELECT count(id) In_Use, SignupEmail FROM ActiveScratchOrg GROUP BY SignupEmail ORDER BY count(id) DESC";
    const results = (await conn.query(query)) as any;
    SFPLogger.log(
      `Info Fetched: ${JSON.stringify(results)}`,
      LoggerLevel.DEBUG
    );

    let scratchOrgRecordAsMapByUser = this.arrayToObject(
      results.records,
      "SignupEmail"
    );
    return scratchOrgRecordAsMapByUser;
  }

  public async getScratchOrgIdGivenUserName(username:string)
  {
    let conn = this.hubOrg.getConnection();
    let query = `SELECT Id FROM ActiveScratchOrg WHERE SignupUsername = '${username}'`;
    return  retry(
      async (bail) => {
         SFPLogger.log("QUERY:" + query,LoggerLevel.TRACE);
        const results = (await conn.query(query)) as any;
        return results.records[0].Id;
      },
      { retries: 3, minTimeout: 3000 }
    );
   
  }

  private arrayToObject = (array, keyfield) =>
    array.reduce((obj, item) => {
      obj[item[keyfield]] = item;
      return obj;
    }, {});
}
