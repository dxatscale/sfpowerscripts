import { Org } from "@salesforce/core";
import PreRequisiteCheck from "./prequisitecheck/PreRequisiteCheck";





export  abstract class PoolBaseImpl
{

  protected hubOrg:Org;

  constructor(hubOrg:Org)
  {
    this.hubOrg = hubOrg;
  }

  public async execute():Promise<any> {
    let prerequisiteCheck: PreRequisiteCheck = new PreRequisiteCheck(this.hubOrg)
    let prerequisiteResult = await prerequisiteCheck.checkForPrerequisites();
    if(prerequisiteResult.isErr())
     return prerequisiteResult;
    else
      return this.onExec();
  }

  protected abstract onExec():Promise<any>;

 
}