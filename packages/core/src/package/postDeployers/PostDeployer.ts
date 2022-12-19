import { Logger } from "@dxatscale/sfp-logger";
import { Connection } from "@salesforce/core";
import { ComponentSet } from "@salesforce/source-deploy-retrieve";
import SfpPackage from "../SfpPackage";

export interface PostDeployer
{
  gatherPostDeploymentComponents(sfpPackage: SfpPackage, conn: Connection, logger: Logger): Promise<ComponentSet>;
  isEnabled(sfpPackage:SfpPackage, conn:Connection,logger:Logger):Promise<boolean>;
  getName():string
}