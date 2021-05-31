import { Org } from "@salesforce/core";
import ScratchOrg from "./ScratchOrg";
import { ScriptExecutionResult } from "./ScriptExecutionResult";

export default interface PoolScriptExecutor
{
  execute(scratchOrg:ScratchOrg,hubOrg:Org):Promise<ScriptExecutionResult>;
}