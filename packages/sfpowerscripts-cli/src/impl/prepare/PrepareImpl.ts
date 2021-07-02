
import { Org } from "@salesforce/core";
import { PoolConfig } from "../pool/PoolConfig";
import { PreparePoolInterface } from "./PreparePoolInterface";
import PreparePool from "./PreparePool";




export default class PrepareImpl {


  public constructor(
    private hubOrg: Org,
    private pool:PoolConfig
  ) {

    // set defaults
    if(!this.pool.expiry) this.pool.expiry = 2;

    if(!this.pool.batchsize) this.pool.batchsize = 5;

  }


  public async exec()
  {

    let poolPreparer:PreparePoolInterface;

    poolPreparer = new PreparePool(this.hubOrg,this.pool);

    return poolPreparer.poolScratchOrgs();
  }


}
