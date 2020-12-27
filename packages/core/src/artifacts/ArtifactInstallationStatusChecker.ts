import ArtifactInstallationStatusUpdater from "./ArtifactInstallationStatusUpdater";
import InstalledAritfactsFetcher from "./InstalledAritfactsFetcher";
import PackageMetadata from "../PackageMetadata";
import SFPLogger from "../utils/SFPLogger";

export default class ArtifactInstallationStatusChecker {


  public static async checkWhetherPackageIsIntalledInOrg(
    target_org: string,
    packageMetadata: PackageMetadata,
    subdirectory:string,
    isHandledByCaller: boolean
  ): Promise<boolean> {
    if (isHandledByCaller) return false; //This is already handled by the caller, in that case if it reached here, we should 
                                         //always install

    try {
      let installedArtifacts = await InstalledAritfactsFetcher.getListofArtifacts(
        target_org
      );

      let packageName= packageMetadata.package_name+(subdirectory?"_"+subdirectory:"");
      for (const artifact of installedArtifacts) {
        if (
          artifact.Name === packageName && artifact.Version__c === packageMetadata.package_version_number
        ) {
          return true;
        }
      }
    } catch (error) {
      SFPLogger.log("Unable to fetch artifacts from the org");
    }
    return false;
  }
}
