
import { Org } from "@salesforce/core";
import { PoolConfig } from "../pool/PoolConfig";
import { PreparePoolInterface } from "./PreparePoolInterface";
import PreparePool from "./PreparePool";
import { err } from "neverthrow";
import { PoolErrorCodes } from "../pool/PoolError";




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

    if(!this.hubOrg.getConnection().refreshToken)
      throw new  Error(`Pools have to be created using a DevHub authenticated with auth:web or auth:store or auth:accesstoken:store`);

    poolPreparer = new PreparePool(this.hubOrg,this.pool);

    return poolPreparer.poolScratchOrgs();
  }


}
