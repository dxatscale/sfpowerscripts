import { isNullOrUndefined } from "util";
let fs = require("fs-extra");
let path = require("path");
const Table = require("cli-table");

export default class ManifestHelpers {


  public static getAllPackages(projectDirectory: string): string[] {
    let projectConfig = ManifestHelpers.getSFDXPackageManifest(projectDirectory);
    let sfdxpackages=[];
    projectConfig["packageDirectories"].forEach((pkg) => {
     sfdxpackages.push(pkg["package"]);
    });
    return sfdxpackages;
  }


  public static getSFDXPackageManifest(projectDirectory: string): { any } {
    let projectConfigJSON: string;
    if (!isNullOrUndefined(projectDirectory)) {
      projectConfigJSON = path.join(projectDirectory, "sfdx-project.json");
    } else {
      projectConfigJSON = "sfdx-project.json";
    }

    let projectConfig = JSON.parse(fs.readFileSync(projectConfigJSON, "utf8"));

    if (isNullOrUndefined(projectConfig))
      throw new Error(
        `sfdx-project.json doesn't exist or not reable at ${projectConfigJSON}`
      );
    else return projectConfig;
  }

  public static getPackageType(projectConfig:any, sfdxPackage: string) {
    let packageFound: boolean;
    if (sfdxPackage) {
      projectConfig["packageDirectories"].forEach((pkg) => {
        if (sfdxPackage == pkg["package"]) {
          packageFound = true;
        }
      });
    }

    if (!packageFound)
      throw new Error("Package or package directory does not exist");
    else {
      if (projectConfig["packageAliases"][sfdxPackage]) {
        return "Unlocked";
      } else {
        return "Source";
      }
    }
  }

  public static getSFDXPackageDescriptor(
    projectDirectory: string,
    sfdxPackage: string
  ): any {
    let packageDirectory: string;
    let sfdxPackageDescriptor: any;

    let projectConfig = ManifestHelpers.getSFDXPackageManifest(
      projectDirectory
    );

    if (!isNullOrUndefined(sfdxPackage)) {
      projectConfig["packageDirectories"].forEach((pkg) => {
        if (sfdxPackage == pkg["package"]) {
          packageDirectory = pkg["path"];
          sfdxPackageDescriptor = pkg;
        }
      });
    }

    if (isNullOrUndefined(packageDirectory))
      throw new Error("Package or package directory does not exist");
    else return sfdxPackageDescriptor;
  }

  public static getDefaultSFDXPackageDescriptor(projectDirectory: string): any {
    let packageDirectory: string;
    let sfdxPackageDescriptor: any;

    let projectConfigJSON: string;
    if (!isNullOrUndefined(projectDirectory)) {
      projectConfigJSON = path.join(projectDirectory, "sfdx-project.json");
    } else {
      projectConfigJSON = "sfdx-project.json";
    }

    let projectConfig = JSON.parse(fs.readFileSync(projectConfigJSON, "utf8"));

    //Return the default package directory
    projectConfig["packageDirectories"].forEach((pkg) => {
      if (pkg["default"] == true) {
        packageDirectory = pkg["path"];
        sfdxPackageDescriptor = pkg;
      }
    });

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
    } else {
      let i = sfdxManifest["packageDirectories"].length;
      while (i--) {
        if (!fs.existsSync(sfdxManifest["packageDirectories"][i]["path"])) {
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

  public static printMetadataToDeploy(mdapiPackageManifest) {
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
    console.log("The following metadata will be deployed:");
    console.log(table.toString());
  }
}
