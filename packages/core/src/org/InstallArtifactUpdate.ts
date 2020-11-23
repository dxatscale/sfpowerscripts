import child_process = require("child_process");
import PackageMetadata from "../PackageMetadata";
import SFPLogger from "../utils/SFPLogger";
import InstalledAritfactsFetcher from "./InstalledAritfactsFetcher";
const retry = require("async-retry");

//Update sfpowerscripts Artifats installed in an Org
export default class InstallArtifactUpdate {
  public static async updateArtifact(
    username: string,
    packageMetadata: PackageMetadata
  ): Promise<boolean> {
    let artifactId = InstallArtifactUpdate.getRecordId(
      username,
      packageMetadata
    );

    return await retry(
      async (bail) => {
        SFPLogger.log("Updating Org with new Artifacts");
        let cmdOutput;
        if (artifactId == null) {
          cmdOutput = child_process.execSync(
            `sfdx force:data:record:create -s SfpowerscriptsArtifact__c -u ${username} \
            -v "Name=${packageMetadata.package_name} Tag__c=${packageMetadata.tag} Version__c=${packageMetadata.package_version_number} CommitId__c=${packageMetadata.sourceVersion}`,
            { encoding: "utf8" }
          );
        } else if (artifactId) {
          cmdOutput = child_process.execSync(
            `sfdx force:data:record:update -s SfpowerscriptsArtifact__c -u ${username} \
              -v "Name=${packageMetadata.package_name} Tag__c=${packageMetadata.tag} Version__c=${packageMetadata.package_version_number} CommitId__c=${packageMetadata.sourceVersion} -i ${artifactId}`,
            { encoding: "utf8" }
          );
        }

        let result = JSON.parse(cmdOutput);
        if (result["status"] == 0 && result["result"]["success"]) {
          return true;
        } else {
          bail(
            new Error(
              "Unable to update any sfpowerscripts artifacts in the org\n" +
                "1. No permissions avaialbe to update the object \n" +
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
  ): Promise<boolean> {
    let installedArtifacts = await InstalledAritfactsFetcher.getListofArtifacts(
      username
    );
    for (const artifact of installedArtifacts) {
      if (
        artifact.Name === packageMetadata.package_name &&
        artifact.Version__c === packageMetadata.package_version_number
      ) {
        return artifact.Id;
      }
    }
    return null;
  }
}
