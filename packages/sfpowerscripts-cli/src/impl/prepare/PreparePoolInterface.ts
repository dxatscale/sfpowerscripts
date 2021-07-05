import { PoolError } from "../pool/PoolError";
import { Result } from "neverthrow"
import { PoolConfig } from "../pool/PoolConfig";




export interface PreparePoolInterface
{
   poolScratchOrgs(): Promise<Result<PoolConfig,PoolError>>
}
