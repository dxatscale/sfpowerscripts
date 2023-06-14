import { Logger } from "@dxatscale/sfp-logger";
import { Connection } from "@salesforce/core";
import { ComponentSet } from "@salesforce/source-deploy-retrieve";
import { DeploymentOptions } from "../../deployers/DeploySourceToOrgImpl";
import SfpPackage from "../SfpPackage";
import SFPOrg from "../../org/SFPOrg";
import { DeploySourceResult } from "../../deployers/DeploymentExecutor";

export interface DeploymentContext
{
    apiVersion: string;
    waitTime: string;
}

export interface DeploymentCustomizer
{
  gatherComponentsToBeDeployed(sfpPackage: SfpPackage, componentSet:ComponentSet, conn: Connection, logger: Logger):Promise<{location:string, componentSet:ComponentSet}>;
  isEnabled(sfpPackage:SfpPackage, conn:Connection,logger:Logger):Promise<boolean>;
  getDeploymentOptions( target_org: string, waitTime: string, apiVersion: string):Promise<DeploymentOptions>
  getName():string
  execute(sfpPackage: SfpPackage,
    componentSet: ComponentSet,
    sfpOrg:SFPOrg,
    logger: Logger,
    deploymentContext:DeploymentContext
    ):Promise<DeploySourceResult>
}