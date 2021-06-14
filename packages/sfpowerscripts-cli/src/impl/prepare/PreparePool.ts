import { PoolError } from "../pool/PoolError";
import { Result } from "neverthrow"
import { PoolConfig } from "../pool/PoolConfig";




export interface PreparePool
{
   poolScratchOrgs(): Promise<Result<PoolConfig,PoolError>>
}
