import InstalledAritfactsFetcher from "./InstalledAritfactsFetcher";
import PackageMetadata from "../PackageMetadata";
import SFPLogger, { Logger, LoggerLevel } from "../logger/SFPLogger";
import ArtifactMigrator from "./ArtifactMigrator";


export default class ArtifactInstallationStatusChecker {


  public static async checkWhetherPackageIsIntalledInOrg(
    logger:Logger,
    target_org: string,
    packageMetadata: PackageMetadata,
  ): Promise<{isInstalled:boolean,versionNumber?:string}> {
  
    let result:{isInstalled:boolean,versionNumber?:string}={isInstalled:false};
    try {

      SFPLogger.log(`Querying for version of  ${packageMetadata.package_name} in the Org..`,LoggerLevel.INFO,logger);
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
      SFPLogger.log("Unable to fetch any sfpowerscripts artifacts in the org\n" +
      "1. sfpowerscripts package is not installed in the org\n" +
      "2. The required prerequisite object is not deployed to this org\n",LoggerLevel.WARN,logger)
    }
    return result;
  }
}
