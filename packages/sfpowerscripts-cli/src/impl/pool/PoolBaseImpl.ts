import { Org } from "@salesforce/core";
import { PreRequisiteCheck } from "./prequisitecheck/PreRequisiteCheck";
import { ScratchOrg } from "./ScratchOrg";


export  abstract class PoolBaseImpl
{

  protected hubOrg:Org;

  constructor(hubOrg:Org)
  {
    this.hubOrg = hubOrg;
  }

  public async execute():Promise<ScratchOrg|ScratchOrg[]> {
    new PreRequisiteCheck(this.hubOrg).checkForPrerequisites();
    return this.onExec();
  }

  protected abstract onExec():Promise<ScratchOrg|ScratchOrg[]>;

 
}