import InstalledAritfactsFetcher from "./InstalledAritfactsFetcher";
import PackageMetadata from "../PackageMetadata";
import SFPLogger from "../utils/SFPLogger";

export default class ArtifactInstallationStatusChecker {


  public static async checkWhetherPackageIsIntalledInOrg(
    target_org: string,
    packageMetadata: PackageMetadata,
    isHandledByCaller: boolean
  ): Promise<{isInstalled:boolean,versionNumber?:string}> {
    if (isHandledByCaller) return {isInstalled:false}; //This is already handled by the caller, in that case if it reached here, we should 
                                         //always install
    let result:{isInstalled:boolean,versionNumber?:string}={isInstalled:false};
    try {
      result.isInstalled=false;
      let installedArtifacts = await InstalledAritfactsFetcher.getListofArtifacts(
        target_org
      );
      let packageName= packageMetadata.package_name;
      for (const artifact of installedArtifacts) {
        if(artifact.Name === packageName)
        {
          result.versionNumber=artifact.Version__c;
          if(artifact.Version__c === packageMetadata.package_version_number)
          {
            result.isInstalled=true;
            return result;
          }
        }
      }
    } catch (error) {
      SFPLogger.log("Unable to fetch artifacts from the org");
    }
    return result;
  }
}
