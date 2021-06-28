import child_process = require("child_process");
import PackageMetadata from "../PackageMetadata";
import SFPLogger, { COLOR_KEY_MESSAGE, Logger, LoggerLevel } from "../logger/SFPLogger";
import InstalledAritfactsFetcher from "./InstalledAritfactsFetcher";
const retry = require("async-retry");
import ArtifactMigrator from "./ArtifactMigrator";

//Update sfpowerscripts Artifats installed in an Org
export default class ArtifactInstallationStatusUpdater {




  public static async updatePackageInstalledInOrg(
    logger:Logger,
    target_org: string,
    packageMetadata: PackageMetadata,
  ):Promise<boolean> {

    try {
      return  await ArtifactInstallationStatusUpdater.updateArtifact(logger,target_org, packageMetadata);
    } catch (error) {
      SFPLogger.log(
        `Unable to update details about artifacts to the org: ${error}`,LoggerLevel.DEBUG,logger
      );
      return false;
    }
  }


  private static async updateArtifact(
    logger:Logger,
    username: string,
    packageMetadata: PackageMetadata,
  ): Promise<boolean> {


    let artifactId = await ArtifactInstallationStatusUpdater.getRecordId(
      username,
      packageMetadata
    );



    return await retry(
      async (bail) => {

        let cmdOutput;
        let packageName= packageMetadata.package_name;
        SFPLogger.log(COLOR_KEY_MESSAGE(`Updating Org with new Artifacts ${packageName} ${packageMetadata.package_version_number} ${(artifactId?artifactId:"")}`), LoggerLevel.INFO,logger);
        if (artifactId == null) {
          cmdOutput = child_process.execSync(
            `sfdx force:data:record:create --json -s ${ArtifactMigrator.objectApiName} -u ${username}  -v "Name=${packageName} Tag__c=${packageMetadata.tag} Version__c=${packageMetadata.package_version_number} CommitId__c=${packageMetadata.sourceVersion}"`,
            { encoding: "utf8",stdio:"pipe"}
          );
        } else if (artifactId) {
          cmdOutput = child_process.execSync(
            `sfdx force:data:record:update --json -s ${ArtifactMigrator.objectApiName} -u ${username} -v "Name=${packageName} Tag__c=${packageMetadata.tag} Version__c=${packageMetadata.package_version_number} CommitId__c=${packageMetadata.sourceVersion}" -i ${artifactId}`,
            { encoding: "utf8" ,stdio:"pipe"}
          );
        }


        let result = JSON.parse(cmdOutput);

        if (result["status"] == 0 && result["result"]["success"]) {
          return true;
        } else {
          bail(
            new Error(
              "Unable to update any sfpowerscripts artifacts in the org\n" +
                "1. No permissions available to update the object \n" +
                "2. The required prerequisite object is not deployed to this org\n"
            )
          );
        }
      },
      { retries: 3, minTimeout: 2000 }
    );
  }

  private static async getRecordId(
    username: string,
    packageMetadata: PackageMetadata
  ): Promise<string> {
    let installedArtifacts = await InstalledAritfactsFetcher.getListofArtifacts(
      username
    );

    let packageName = packageMetadata.package_name;
    for (const artifact of installedArtifacts) {
      if (
        artifact.Name === packageName
      ) {
        return artifact.Id;
      }
    }
    return null;
  }
}
