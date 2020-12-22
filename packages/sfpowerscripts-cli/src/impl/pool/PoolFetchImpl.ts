import SFPLogger from "@dxatscale/sfpowerscripts.core/lib/utils/SFPLogger";
import SFPStatsSender from "@dxatscale/sfpowerscripts.core/lib/utils/SFPStatsSender";
import { Org, SfdxError } from "@salesforce/core";
import ScratchOrgUtils, { ScratchOrg } from "./utils/ScratchOrgUtils";

export default class PoolFetchImpl {
  private hubOrg: Org;
  private tag: string;
  private mypool: boolean;


  public constructor(
    hubOrg: Org,
    tag: string,
    mypool: boolean
  ) {
    this.hubOrg = hubOrg;
    this.tag = tag;
    this.mypool = mypool;
  }

  public async execute(): Promise<ScratchOrg> {
    await ScratchOrgUtils.checkForNewVersionCompatible(this.hubOrg);
    const results = (await ScratchOrgUtils.getScratchOrgsByTag(
      this.tag,
      this.hubOrg,
      this.mypool,
      true
    )) as any;


    SFPStatsSender.logGauge("pool.remaining",results.records.length,{poolName:this.tag});

    let soDetail: ScratchOrg;

    if (results.records.length > 0) {


      for (let element of results.records) {
        let allocateSO = await ScratchOrgUtils.setScratchOrgInfo(
          { Id: element.Id, Allocation_status__c: "Allocate" },
          this.hubOrg
        );
        if (allocateSO === true) {
          SFPLogger.log(
            `Scratch org ${element.SignupUsername} is allocated from the pool. Expiry date is ${element.ExpirationDate}`
          );
          soDetail = {};
          soDetail["Id"] = element.Id;
          soDetail.orgId = element.ScratchOrg;
          soDetail.loginURL = element.LoginUrl;
          soDetail.username = element.SignupUsername;
          soDetail.password = element.Password__c;
          soDetail.expityDate = element.ExpirationDate;
          soDetail.status = "Assigned";

          break;
        }
      }
    }

    if (results.records.length == 0 || !soDetail) {
      throw new SfdxError(
        `No scratch org available at the moment for ${this.tag}, try again in sometime.`
      );
    }

    return soDetail;
  }
}
