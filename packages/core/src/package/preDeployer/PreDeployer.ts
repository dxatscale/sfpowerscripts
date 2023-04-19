import SFPLogger, { COLOR_KEY_MESSAGE, Logger, LoggerLevel } from '@dxatscale/sfp-logger';
import { Connection } from "@salesforce/core";
import { ComponentSet } from "@salesforce/source-deploy-retrieve";
import SfpPackage from "../SfpPackage";

export interface PreDeployer
{
  execute(componentSet:ComponentSet, conn: Connection, logger: Logger);
  isEnabled(sfpPackage:SfpPackage, conn:Connection,logger:Logger):Promise<boolean>;
  getName():string
}
