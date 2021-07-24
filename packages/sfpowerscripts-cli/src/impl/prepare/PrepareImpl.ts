
import { Org } from "@salesforce/core";
import { PoolConfig } from "../pool/PoolConfig";
import { PreparePoolInterface } from "./PreparePoolInterface";
import PreparePool from "./PreparePool";
import OrgDisplayImpl from "@dxatscale/sfpowerscripts.core/lib/sfdxwrappers/OrgDisplayImpl";
import isValidSfdxAuthUrl from "../pool/prequisitecheck/IsValidSfdxAuthUrl";
import SFPLogger, { COLOR_KEY_MESSAGE, LoggerLevel } from "@dxatscale/sfpowerscripts.core/lib/logger/SFPLogger";



export default class PrepareImpl {


  public constructor(
    private hubOrg: Org,
    private pool:PoolConfig
  ) {

    // set defaults
    if(!this.pool.expiry) this.pool.expiry = 2;

    if(!this.pool.batchSize) this.pool.batchSize = 5;

  }


  public async exec()
  {
    let poolPreparer:PreparePoolInterface;

    SFPLogger.log(COLOR_KEY_MESSAGE("Validating Org Authentication Mechanism.."),LoggerLevel.INFO);
    let orgDisplayImpl = new OrgDisplayImpl(null, this.hubOrg.getUsername());
    let orgDisplayResult = await orgDisplayImpl.exec(true);

    if(!(orgDisplayResult.sfdxAuthUrl && isValidSfdxAuthUrl(orgDisplayResult.sfdxAuthUrl)))
      throw new  Error(`Pools have to be created using a DevHub authenticated with auth:web or auth:store or auth:accesstoken:store`);

    poolPreparer = new PreparePool(this.hubOrg,this.pool);

    return poolPreparer.poolScratchOrgs();
  }


}
