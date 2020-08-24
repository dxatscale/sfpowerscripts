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
      //Return full descriptor
      packageDirectory = null;
      sfdxPackageDescriptor = projectJson;
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
    return sfdxManifest;
  }
}
