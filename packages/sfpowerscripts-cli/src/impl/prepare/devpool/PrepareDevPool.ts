
import { Org } from "@salesforce/core";
import PoolCreateImpl from "../../pool/PoolCreateImpl";
import { PoolConfig } from "../../pool/PoolConfig";
import PrepareDevOrgWithScript from "./PrepareDevOrgWithScript";
import { PreparePool } from "../PreparePool";
import { PoolError } from "../../pool/PoolError";
import { Result} from "neverthrow"
import PrepareDevOrgWithPush from "./PrepareDevOrgWithPush";
import ArtifactFilePathFetcher, {
  ArtifactFilePaths,
} from "@dxatscale/sfpowerscripts.core/lib/artifacts/ArtifactFilePathFetcher";



export default class PrepareDevPool implements PreparePool {


  public constructor(
    private hubOrg: Org,
    private pool:PoolConfig
  ) {

  }


  public async poolScratchOrgs(): Promise<Result<PoolConfig,PoolError>> {

    let pool = await this.createPool();
    return pool;
  }


  private async createPool():Promise<Result<PoolConfig,PoolError>>
  {
    let prepareASingleOrgJob;

    if(this.pool.devpool.scriptToExecute) {
      prepareASingleOrgJob = new PrepareDevOrgWithScript(this.pool);
    } else {
      ArtifactFilePathFetcher.fetchArtifactFilePaths("artifacts")
      prepareASingleOrgJob = new PrepareDevOrgWithPush(this.pool);
    }

    let createPool:PoolCreateImpl = new PoolCreateImpl(this.hubOrg,this.pool,prepareASingleOrgJob);
    let pool = await createPool.execute();
    return pool;
  }



}
