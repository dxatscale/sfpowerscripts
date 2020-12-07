import { Org } from "@salesforce/core";
import { ScratchOrg } from "../pool/utils/ScratchOrgUtils";

export default class PrepareASingleOrgImpl {


  public constructor(
    private scratchOrg:ScratchOrg,
    private hubOrg: Org,
    private fetchArtifactScript: string,
    private isAllPackagesToBeInstalled:boolean
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