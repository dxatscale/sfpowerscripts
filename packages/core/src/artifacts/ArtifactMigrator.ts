import child_process = require("child_process");
import * as fs from "fs-extra";
const retry = require("async-retry");
import { Org } from "@salesforce/core";

export default class ArtifactMigrator {

  /**
   * API name of latest SfpowerscriptsArtifact object installed in org
   */
  public static objectApiName: string = null;

  private static isMigrated: boolean = false;

  private static isSfpowerscriptsArtifact2Exist: boolean;
  private static isSfpowerscriptsArtifactExist: boolean;

  private static sfpowerscriptsArtifact2Records;
  private static sfpowerscriptsArtifactRecords;

  public static async exec(username: string): Promise<void> {
    if (
      ArtifactMigrator.isSfpowerscriptsArtifact2Exist === undefined ||
      ArtifactMigrator.isSfpowerscriptsArtifactExist === undefined
    ) {
      await ArtifactMigrator.querySfpowerscriptsArtifact2(username);
      await ArtifactMigrator.querySfpowerscriptsArtifact(username);

      if (ArtifactMigrator.isSfpowerscriptsArtifact2Exist) {
        ArtifactMigrator.objectApiName = "SfpowerscriptsArtifact2__c";
      } else if (ArtifactMigrator.isSfpowerscriptsArtifactExist) {
        console.log("The custom object SfpowerscriptsArtifact__c will be deprecated in future release. Move to the new version of SfpowerscriptsArtifact to maintain compatibility.");
        ArtifactMigrator.objectApiName = "SfpowerscriptsArtifact__c";
      } else {
        ArtifactMigrator.objectApiName = "SfpowerscriptsArtifact__c";
      }
    }

    if (
      ArtifactMigrator.isSfpowerscriptsArtifact2Exist &&
      ArtifactMigrator.isSfpowerscriptsArtifactExist
    ) {
      if (
        ArtifactMigrator.sfpowerscriptsArtifact2Records.length === 0 &&
        ArtifactMigrator.sfpowerscriptsArtifactRecords.length > 0 &&
        !ArtifactMigrator.isMigrated
      ) {
        await ArtifactMigrator.migrate(username);
      }
    }
  }

  /**
   * Migrate records from SfpowerscriptsArtifact__c to SfpowerscriptsArtifact2__c
   */
  private static async migrate(username) {
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
            ArtifactMigrator.isMigrated = true;
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

  /**
   * Sets properties for records and existence of SfpowerscriptsArtifact2
   * @param username
   */
  private static async querySfpowerscriptsArtifact2(username): Promise<void> {
      try {
        const conn = await (await Org.create({ aliasOrUsername: username })).getConnection();
        let records = (await conn.autoFetchQuery("SELECT Id, Name, CommitId__c, Version__c, Tag__c FROM SfpowerscriptsArtifact2__c")).records;

        if (records) {
          ArtifactMigrator.isSfpowerscriptsArtifact2Exist = true;
          ArtifactMigrator.sfpowerscriptsArtifact2Records = records;
        }
      } catch (error) {
        if (error.errorCode === "INVALID_TYPE") {
          ArtifactMigrator.isSfpowerscriptsArtifact2Exist = false;
        } else {
          console.log(error.message);
          throw error;
        }
      }
  }

  /**
   * Set properties for records and existence of SfpowerscriptsArtifact
   * @param username
   */
  private static async querySfpowerscriptsArtifact(username): Promise<void> {
    try {
      const conn = await (await Org.create({ aliasOrUsername: username })).getConnection();
      let records = (await conn.autoFetchQuery("SELECT Id, Name, CommitId__c, Version__c, Tag__c FROM SfpowerscriptsArtifact__c")).records;

      if (records) {
        ArtifactMigrator.isSfpowerscriptsArtifactExist = true;
        ArtifactMigrator.sfpowerscriptsArtifactRecords = records;
      }
    } catch (error) {
      if (error.errorCode === "INVALID_TYPE") {
        ArtifactMigrator.isSfpowerscriptsArtifactExist = false;
      } else {
        console.log(error.message);
        throw error;
      }
    }
  }

}