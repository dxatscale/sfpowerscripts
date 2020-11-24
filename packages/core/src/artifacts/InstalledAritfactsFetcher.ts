import child_process = require("child_process");
import SFPLogger from "../utils/SFPLogger";
const retry = require("async-retry");

//Fetch sfpowerscripts Artifats installed in an Org
export default class InstalledAritfactsFetcher {
  private static artifacts;

  public static async getListofArtifacts(username: string): Promise<any> {
    if (InstalledAritfactsFetcher.artifacts == null) {
      return await retry(
        async (bail) => {
          SFPLogger.log("Querying Installed Artifacts from the Org");
          let cmdOutput = child_process.execSync(
            `sfdx force:data:soql:query -q "SELECT Id, Name, CommitId__c, Version__c, Tag__c FROM SfpowerscriptsArtifact__c" -r json -u ${username}`,
            { encoding: "utf8" }
          );
          let result = JSON.parse(cmdOutput);
          if (result["status"] == 0) {
            InstalledAritfactsFetcher.artifacts = result["result"]["records"];
            return InstalledAritfactsFetcher.artifacts;
          } else {
            bail(
              new Error(
                "Unable to fetch any sfpowerscripts artifacts in the org\n" +
                  "1. sfpowercripts package is notinstalled in the org\n" +
                  "2. The required prerequisite object is not deployed to this org\n"
              )
            );
          }
        },
        { retries: 3, minTimeout: 2000 }
      );
    } else {
      return InstalledAritfactsFetcher.artifacts;
    }
  }
}
