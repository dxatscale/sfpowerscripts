
import { Org } from "@salesforce/core";
import PoolCreateImpl from "../../pool/PoolCreateImpl";
import { PoolConfig } from "../../pool/PoolConfig";
import PrepareDevOrgWithScript from "./PrepareDevOrgWithScript";
import { PreparePool } from "../PreparePool";




export default class PrepareDevPool implements PreparePool {


  public constructor(
    private hubOrg: Org,
    private pool:PoolConfig
  ) {
   
  }

  
  public async poolScratchOrgs(): Promise<{
    totalallocated: number;
    success: number;
    failed: number;
    errorCode?: string;
  }> {
   
    let pool = await this.createPool();
   
    return {
      totalallocated: pool.to_allocate,
      success:pool.scratchOrgs.length,
      failed: pool.failedToCreate
    };
  }


  private async createPool():Promise<PoolConfig>
  {
    let prepareASingleOrgImpl;

    if(this.pool.devpool.scriptToExecute)
      prepareASingleOrgImpl = new PrepareDevOrgWithScript(this.pool);
 
     let createPool:PoolCreateImpl = new PoolCreateImpl(this.hubOrg,this.pool,prepareASingleOrgImpl);
     let pool = await createPool.execute() as PoolConfig;
     return pool;
  }



}


