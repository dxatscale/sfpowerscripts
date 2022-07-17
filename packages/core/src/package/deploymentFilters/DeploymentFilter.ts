import { ComponentSet } from "@salesforce/source-deploy-retrieve";
import { Logger } from "@dxatscale/sfp-logger";
import SFPOrg from "../../org/SFPOrg";
import { PackageType } from "../SfpPackage";

export interface DeploymentFilter
{
   apply(org: SFPOrg, componentSet: ComponentSet,logger:Logger):Promise<ComponentSet>;
   isToApply(projectConfig: any,packageType:string): boolean;

}


