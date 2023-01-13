import { Logger } from "@dxatscale/sfp-logger";
import { Connection } from "@salesforce/core";
import { ComponentSet } from "@salesforce/source-deploy-retrieve";
import { DeploymentOptions } from "../../deployers/DeploySourceToOrgImpl";
import SfpPackage from "../SfpPackage";

export interface PostDeployer
{
  gatherPostDeploymentComponents(sfpPackage: SfpPackage, componentSet:ComponentSet, conn: Connection, logger: Logger):Promise<{location:string, componentSet:ComponentSet}>;
  isEnabled(sfpPackage:SfpPackage, conn:Connection,logger:Logger):Promise<boolean>;
  getDeploymentOptions( target_org: string, waitTime: string, apiVersion: string):Promise<DeploymentOptions>
  getName():string
}