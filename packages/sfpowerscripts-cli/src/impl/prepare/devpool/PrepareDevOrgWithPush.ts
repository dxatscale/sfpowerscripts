import { Org } from "@salesforce/core";
import { Result } from "neverthrow";
import { PoolConfig } from "../../pool/PoolConfig";
import PoolJobExecutor, { JobError, ScriptExecutionResult } from "../../pool/PoolJobExecutor";
import ScratchOrg from "../../pool/ScratchOrg";

export default class PrepareDevOrgWithPush extends PoolJobExecutor {

   constructor(protected pool:PoolConfig)
   {
     super(pool);
   }

  async executeJob(scratchOrg: ScratchOrg, hubOrg: Org, logToFilePath: string): Promise<Result<ScriptExecutionResult, JobError>> {
    throw new Error("Method not implemented.");
  }
}