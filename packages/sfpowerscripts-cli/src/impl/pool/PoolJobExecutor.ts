import { Org } from "@salesforce/core";
import ScratchOrg from "./ScratchOrg";


export default interface PoolJobExecutor
{
  execute(scratchOrg:ScratchOrg,hubOrg:Org):Promise<ScriptExecutionResult>;
}

export interface ScriptExecutionResult {
  status: string;
  message: string;
  scratchOrgUsername: string;
  isSuccess: boolean;
}