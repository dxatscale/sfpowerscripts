import { AuthInfo, AuthFields, Org, Connection, sfdc } from "@salesforce/core";
import extractDomainFromUrl from "../utils/extractDomainFromUrl";
import { convertAliasToUsername } from "../utils/AliasList";
import SFPLogger, { LoggerLevel } from "../logger/SFPLogger";
import ScratchOrgInfoFetcher from "./ScratchOrgInfoFetcher";
import OrganizationFetcher from "./OrganizationFetcher";

export default class OrgDetailsFetcher {


  private static usernamesToOrgDetails: {[P: string]: OrgDetails} = {};

  constructor(private username: string) {
    this.username = convertAliasToUsername(this.username);
  }

  public async getOrgDetails(): Promise<OrgDetails> {
    if (OrgDetailsFetcher.usernamesToOrgDetails[this.username])
      return OrgDetailsFetcher.usernamesToOrgDetails[this.username];

    const authInfo = await AuthInfo.create({ username: this.username });

    let authInfoFields = authInfo.getFields();

    let sfdxAuthUrl: string;
    try {
      sfdxAuthUrl = authInfo.getSfdxAuthUrl();
    } catch (error) {
      SFPLogger.log(`Unable to get SFDX Auth URL: ${error.message}`, LoggerLevel.TRACE, null);
    }

    const isScratchOrg = authInfoFields.devHubUsername;
    let scratchOrgInfo = isScratchOrg ? await this.getScratchOrgDetails(authInfoFields.orgId, authInfo) : {} as ScratchOrgDetails;

    const organization = await this.getOrganization(authInfo);

    OrgDetailsFetcher.usernamesToOrgDetails[this.username] = {
      sfdxAuthUrl: sfdxAuthUrl,
      ...authInfoFields,
      ...scratchOrgInfo,
      ...organization
    }

    return OrgDetailsFetcher.usernamesToOrgDetails[this.username];
  }

  public async getOrgDomainUrl(): Promise<string> {
    await this.getOrgDetails();

    if (OrgDetailsFetcher.usernamesToOrgDetails[this.username].instanceUrl) {
      let domain = extractDomainFromUrl(OrgDetailsFetcher.usernamesToOrgDetails[this.username].instanceUrl);
      if (domain) return domain;
      else return "";
    } else {
      return "";
    }
  }

  private async getScratchOrgDetails(orgId: string, authInfo: AuthInfo): Promise<ScratchOrgDetails> {

    const hubOrg: Org = await (
      await Org.create({
        connection: await Connection.create({
          authInfo: authInfo,
        }),
      })
    ).getDevHubOrg();

    let scratchOrgInfo = (
      await new ScratchOrgInfoFetcher(hubOrg).getScratchOrgInfoByOrgId([sfdc.trimTo15(orgId)])
    )[0];

    if (scratchOrgInfo) {
      return {
        status: scratchOrgInfo.Status
      }
    } else {
      throw new Error(`No information for scratch org with ID ${sfdc.trimTo15(orgId)} found in Dev Hub ${hubOrg.getUsername()}`);
    }
  }

  private async getOrganization(authInfo: AuthInfo) {
    const connection = await Connection.create({
      authInfo: authInfo
    });

    const results = await new OrganizationFetcher(connection).fetch();

    if (results[0]) {
      return {
        isSandbox: results[0].IsSandbox,
        organizationType: results[0].OrganizationType
      }
    } else {
      throw new Error(`No Organization records found for ${connection.getUsername()}`);
    }
  }
}

export interface OrgDetails extends ScratchOrgDetails, AuthFields, Organization {
  sfdxAuthUrl: string;
};

export interface ScratchOrgDetails {
  status: string;
}

export interface Organization {
  isSandbox: boolean;
  organizationType: string;
}