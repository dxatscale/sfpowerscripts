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
    new PreRequisiteCheck(this.hubOrg).checkForPrerequisites();
    return this.onExec();
  }

  protected abstract onExec():Promise<any>;

 
}