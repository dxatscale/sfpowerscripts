
import { Org } from "@salesforce/core";
import { PoolConfig } from "../pool/PoolConfig";
import { PreparePool } from "./PreparePool";
import PrepareCIPool from "./cipool/PrepareCIPool";
import PrepareDevPool from "./devpool/PrepareDevPool";




export default class PrepareImpl {


  public constructor(
    private hubOrg: Org,
    private pool:PoolConfig
  ) {
   
    //set defaults
    if(!this.pool.expiry)
      this.pool.expiry=1
    if(!this.pool.batchsize)
      this.pool.batchsize=5
    
  }

  
  public async exec()
  {

    let poolPreparer:PreparePool;
    if(this.pool.cipool)
    {
      poolPreparer = new PrepareCIPool(this.hubOrg,this.pool);
    }
    else (this.pool.devpool)
    {
      poolPreparer = new PrepareDevPool(this.hubOrg,this.pool);
    }

    return poolPreparer.poolScratchOrgs();
  }
  

}


