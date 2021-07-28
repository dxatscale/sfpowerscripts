import { AuthInfo, AuthFields } from "@salesforce/core";
import extractDomainFromUrl from "../utils/extractDomainFromUrl";
import { convertAliasToUsername } from "../utils/AliasList";

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
    OrgDetailsFetcher.usernamesToOrgDetails[this.username] = {
      sfdxAuthUrl: authInfo.getSfdxAuthUrl(),
      ...authInfoFields
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
}

export interface OrgDetails extends AuthFields{
  sfdxAuthUrl: string
}