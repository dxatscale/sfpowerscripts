import child_process = require("child_process");
const retry = require("async-retry");
import ArtifactMigrator from "./ArtifactMigrator";

//Fetch sfpowerscripts Artifats installed in an Org
export default class InstalledAritfactsFetcher {
  private static usernamesToArtifacts: {[p: string]: any} = {};

  public static async getListofArtifacts(username: string): Promise<any> {
    await ArtifactMigrator.exec(username);

    if (InstalledAritfactsFetcher.usernamesToArtifacts[username] == null) {
      return await retry(
        async (bail) => {
          let cmdOutput = child_process.execSync(
            `sfdx force:data:soql:query -q "SELECT Id, Name, CommitId__c, Version__c, Tag__c FROM ${ArtifactMigrator.objectApiName}" -r json -u ${username}`,
            { encoding: "utf8", stdio:"pipe" }
          );
          let result = JSON.parse(cmdOutput);
          if (result["status"] == 0) {
            InstalledAritfactsFetcher.usernamesToArtifacts[username] = result["result"]["records"];
            return InstalledAritfactsFetcher.usernamesToArtifacts[username];
          } else {
            bail(
              new Error(
                "Unable to fetch any sfpowerscripts artifacts in the org\n" +
                  "1. sfpowerscripts package is notinstalled in the org\n" +
                  "2. The required prerequisite object is not deployed to this org\n"
              )
            );
          }
        },
        { retries: 3, minTimeout: 2000 }
      );
    } else {
      return InstalledAritfactsFetcher.usernamesToArtifacts[username];
    }
  }

  public static resetFetchedArtifacts()
  {
    this.usernamesToArtifacts = {};
  }
}
