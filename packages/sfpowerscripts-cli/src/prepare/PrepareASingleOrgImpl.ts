import { Org } from "@salesforce/core";
import { ScratchOrg } from "../pool/utils/ScratchOrgUtils";

export default class PrepareASingleOrgImpl {


  public constructor(
    scratchOrg:ScratchOrg,
    hubOrg: Org,
    fetchArtifactScript: string
    isAllPackagesToBeInstalled:boolean;
  ) {

  }

  public async prepare():Promise<ScriptExecutionResult> {
    throw new Error("Method not implemented.");
  }

  
}


export interface ScriptExecutionResult {
  status: string;
  message: string;
  scratchOrgUsername: string;
  isSuccess: boolean;
}