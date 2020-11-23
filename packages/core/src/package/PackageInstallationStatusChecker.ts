import InstallArtifactUpdate from "../org/InstallArtifactUpdate";
import InstalledAritfactsFetcher from "../org/InstalledAritfactsFetcher";
import PackageMetadata from "../PackageMetadata";
import SFPLogger from "../utils/SFPLogger";

export default class PackageInstallationStatusChecker {


  public static async checkWhetherPackageIsIntalledInOrg(
    target_org: string,
    packageMetadata: PackageMetadata,
    subdirectory:string,
    isHandledByCaller: boolean
  ): Promise<boolean> {
    if (isHandledByCaller) return true;

    try {
      let installedArtifacts = await InstalledAritfactsFetcher.getListofArtifacts(
        target_org
      );
      for (const artifact of installedArtifacts) {
        if (
          artifact.Name === packageMetadata.package_name && artifact.Subdirectory__c === subdirectory
        ) {
          return true;
        }
      }
    } catch (error) {
      SFPLogger.log("Unable to fetch artifacts from the org", error);
    }
    return false;
  }

  public static async updatePackageInstalledInOrg(
    target_org: string,
    packageMetadata: PackageMetadata,
    isHandledByCaller: boolean
  ):Promise<boolean> {
    if (isHandledByCaller) return true;

    try {
      await InstallArtifactUpdate.updateArtifact(target_org, packageMetadata);
    } catch (error) {
      SFPLogger.log(
        "Unable to update details about artifacts to the org",
        error
      );
    }
    return false;
  }
}
