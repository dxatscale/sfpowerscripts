import child_process = require("child_process");
import * as fs from "fs-extra";
const retry = require("async-retry");

export default class ArtifactMigrator {
  public static objectApiName: string = null;
  private static sfpowerscriptsArtifact2Records;
  private static sfpowerscriptsArtifactRecords;

  public static async migrateArtifacts(username: string): Promise<void> {
    if (
      ArtifactMigrator.isSfpowerscriptsArtifact2Exist(username) &&
      ArtifactMigrator.isSfpowerscriptsArtifactExist(username)
    ) {
      if (
        ArtifactMigrator.sfpowerscriptsArtifact2Records.length === 0 &&
        ArtifactMigrator.sfpowerscriptsArtifactRecords.length > 0
      ) {
        // Migrate records
        console.log("Migrating records to SfpowerscriptsArtifact2__c...");

        let recordsToImport = {records: []};
        ArtifactMigrator.sfpowerscriptsArtifactRecords.forEach((record, idx) => {
          recordsToImport.records.push({
            attributes: {
              type: "SfpowerscriptsArtifact2__c",
              referenceId: `SfpowerscriptsArtifact2_${idx}`
            },
            Name: record.Name,
            Tag__c: record.Tag__c,
            Version__c: record.Version__c,
            CommitId__c: record.CommitId__c
          });
        });

        fs.writeFileSync(
          "SfpowerscriptsArtifact2SObjectTreeFile.json",
          JSON.stringify(recordsToImport)
        );

        try {
          await retry (
            async (bail) => {
              let importResultJson = child_process.execSync(
                `sfdx force:data:tree:import -f SfpowerscriptsArtifact2SObjectTreeFile.json -u ${username} --json`,
                {
                  encoding: "utf8",
                  stdio:"pipe"
                }
              );

              let importResult = JSON.parse(importResultJson);
              if (importResult.status === 1) {
                throw new Error("Failed to migrate records from SfpowerscriptsArtifact__c to SfpowerscriptsArtifact2__c");
              } else {
                return;
              }
            },
            { retries: 3, minTimeout: 2000 }
          );
        } catch (error) {
          console.log(error.message);
          throw error;
        } finally {
          fs.unlinkSync("SfpowerscriptsArtifact2SObjectTreeFile.json");
        }
      }
    }
  }

  private static isSfpowerscriptsArtifact2Exist(username): boolean {
      try {
        let queryResultJson = child_process.execSync(
          `sfdx force:data:soql:query -q "SELECT Id, Name, CommitId__c, Version__c, Tag__c FROM SfpowerscriptsArtifact2__c" -r json -u ${username}`,
          {
            encoding: "utf8",
            stdio:"pipe"
          }
        );

        let queryResult = JSON.parse(queryResultJson);
        if (
          queryResult.status === 1 &&
          queryResult.message.includes("sObject type 'SfpowerscriptsArtifact2__c' is not supported")
        ) {
          return false;
        } else if (queryResult.status === 1) {
          throw new Error(queryResult.message);
        } else {
          ArtifactMigrator.sfpowerscriptsArtifact2Records = queryResult.result.records;
          ArtifactMigrator.objectApiName = "SfpowerscriptsArtifact2__c";
          return true;
        }

      } catch (error) {
        if (error.message.includes("sObject type 'SfpowerscriptsArtifact2__c' is not supported")) {
          return false;
        } else throw error;
      }
  }

  private static isSfpowerscriptsArtifactExist(username): boolean {
    try {
      let queryResultJson = child_process.execSync(
        `sfdx force:data:soql:query -q "SELECT Id, Name, CommitId__c, Version__c, Tag__c FROM SfpowerscriptsArtifact__c" -r json -u ${username}`,
        {
          encoding: "utf8",
          stdio:"pipe"
        }
      );

      let queryResult = JSON.parse(queryResultJson);
      if (
        queryResult.status === 1 &&
        queryResult.message.includes("sObject type 'SfpowerscriptsArtifact__c' is not supported")
      ) {
        return false;
      } else if (queryResult.status === 1) {
        throw new Error(queryResult.message);
      } else {
        ArtifactMigrator.sfpowerscriptsArtifactRecords = queryResult.result.records;
        if (ArtifactMigrator.objectApiName !== "SfpowerscriptsArtifact2__c") {
          console.log("The custom object SfpowerscriptsArtifact__c will be deprecated in future release. Move to the new version of SfpowerscriptsArtifact to maintain compatibility.");
          ArtifactMigrator.objectApiName = "SfpowerscriptsArtifact__c"
        }
        return true;
      }
    } catch (error) {
      if (error.message.includes("sObject type 'SfpowerscriptsArtifact__c' is not supported")) {
        return false;
      } else throw error;
    }
  }

}