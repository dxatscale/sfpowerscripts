import { Logger } from "@dxatscale/sfp-logger";
import SfpPackage from "../SfpPackage";

export interface PackageAnalyzer
{
  
  analyze(sfpPackage: SfpPackage,logger:Logger): Promise<SfpPackage>
  isEnabled(sfpPackage: SfpPackage,logger:Logger): Promise<boolean> 

  
}