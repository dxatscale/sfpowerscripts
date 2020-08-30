import { isNullOrUndefined } from "util";
let fs = require("fs-extra");
let path = require("path");

export default class ManifestHelpers {
  public static getSFDXPackageDescriptor(
    projectDirectory: string,
    sfdxPackage: string
  ): { any } {
    let packageDirectory: string;
    let sfdxPackageDescriptor: any;

    let projectConfig: string;
    if (!isNullOrUndefined(projectDirectory)) {
      projectConfig = path.join(projectDirectory, "sfdx-project.json");
    } else {
      projectConfig = "sfdx-project.json";
    }

    let projectJson = JSON.parse(fs.readFileSync(projectConfig, "utf8"));

    if (!isNullOrUndefined(sfdxPackage)) {
      projectJson["packageDirectories"].forEach((pkg) => {
        if (sfdxPackage == pkg["package"]) {
          packageDirectory = pkg["path"];
          sfdxPackageDescriptor = pkg;
        }
      });
    } else {
      //Return the default package directory
      projectJson["packageDirectories"].forEach((pkg) => {
        if (pkg["default"] == true) {
          packageDirectory = pkg["path"];
          sfdxPackageDescriptor = pkg;
        }
      });
      return sfdxPackageDescriptor;
    }

    if (isNullOrUndefined(packageDirectory))
      throw new Error("Package or package directory not exist");
    else return sfdxPackageDescriptor;
  }

  public static cleanupMPDFromManifest(
    projectDirectory: string,
    sfdxPackage: string
  ): any {
    let projectConfig: string;
    if (!isNullOrUndefined(projectDirectory)) {
      projectConfig = path.join(projectDirectory, "sfdx-project.json");
    } else {
      projectConfig = "sfdx-project.json";
    }

    let sfdxManifest = JSON.parse(fs.readFileSync(projectConfig, "utf8"));
    if (!isNullOrUndefined(sfdxPackage)) {
      let i = sfdxManifest["packageDirectories"].length;
      while (i--) {
        if (sfdxPackage != sfdxManifest["packageDirectories"][i]["package"]) {
          sfdxManifest["packageDirectories"].splice(i, 1);
        }
      }
    }

    sfdxManifest["packageDirectories"][0]["default"] = true; //add default = true
    return sfdxManifest;
  }

  public static checkApexInPayload(manifest: any) {
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

  public static checkProfilesinPayload(manifest: any) {
    let isProfilesFound = false;
    if (Array.isArray(manifest["Package"]["types"])) {
      for (let type of manifest["Package"]["types"]) {
        if (type["name"] == "Profiles") {
          isProfilesFound = true;
          break;
        }
      }
    } else if (
      manifest["Package"]["types"]["name"] == "ApexClass" ||
      manifest["Package"]["types"]["name"] == "ApexTrigger"
    ) {
      isProfilesFound = true;
    }
    return isProfilesFound;
  }
}
