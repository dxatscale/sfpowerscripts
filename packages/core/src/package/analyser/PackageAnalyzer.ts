import SfpPackage from "../SfpPackage";

export interface PackageAnalyzer
{
  
  analyze(sfpPackage: SfpPackage): Promise<SfpPackage>
  isEnabled(sfpPackage: SfpPackage): Promise<boolean> 

  
}