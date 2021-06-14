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
    let prerequisiteResult = new PreRequisiteCheck(this.hubOrg).checkForPrerequisites();
    if((await prerequisiteResult).isErr())
     return prerequisiteResult;
    else
      return this.onExec();
  }

  protected abstract onExec():Promise<any>;

 
}