const Table = require("cli-table");
import SFPLogger from "../utils/SFPLogger";


export class PackageXMLManifestHelpers
{
  public static checkApexInPayload(manifest: any):boolean {
    let isApexFound = false;
    if (Array.isArray(manifest["Package"]["types"])) {
      for (let type of manifest["Package"]["types"]) {
        if (type["name"] == "ApexClass" || type["name"] == "ApexTrigger") {
          isApexFound = true;
          break;
        }
      }
    } else if (
      manifest["Package"]["types"]["name"] == "ApexClass" ||
      manifest["Package"]["types"]["name"] == "ApexTrigger"
    ) {
      isApexFound = true;
    }
    return isApexFound;
  }

  public static checkProfilesinPayload(manifest: any):boolean {
    let isProfilesFound = false;
    if (Array.isArray(manifest["Package"]["types"])) {
      for (let type of manifest["Package"]["types"]) {
        if (type["name"] == "Profile") {
          isProfilesFound = true;
          break;
        }
      }
    } else if (manifest["Package"]["types"]["name"] == "Profile") {
      isProfilesFound = true;
    }
    return isProfilesFound;
  }

  public static printMetadataToDeploy(mdapiPackageManifest,packageLogger?:any) {
    //If Manifest is null, just return
    if (mdapiPackageManifest === null || mdapiPackageManifest === undefined)
      return;

    let table = new Table({
      head: ["Metadata Type", "API Name"],
    });

    let pushTypeMembersIntoTable = (type) => {
      if (type["members"] instanceof Array) {
        for (let member of type["members"]) {
          let item = [type.name, member];
          table.push(item);
        }
      } else {
        let item = [type.name, type.members];
        table.push(item);
      }
    };

    if (mdapiPackageManifest["Package"]["types"] instanceof Array) {
      for (let type of mdapiPackageManifest["Package"]["types"]) {
        pushTypeMembersIntoTable(type);
      }
    } else {
      let type = mdapiPackageManifest["Package"]["types"];
      pushTypeMembersIntoTable(type);
    }
    SFPLogger.log("The following metadata will be deployed:",null,packageLogger);
    SFPLogger.log(table.toString(),null,packageLogger);
  }
}