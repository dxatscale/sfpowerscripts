import { isNullOrUndefined } from "util";
import * as fs from "fs-extra";
let path = require("path");


export default class ManifestHelpers {


  public static getPackageId(projectConfig: any, sfdxPackage: string) {
     if (projectConfig["packageAliases"]?.[sfdxPackage]) {
       return projectConfig["packageAliases"][sfdxPackage]
     }
     else
     {
       throw Error("No Package Id found in sfdx-project.json. Please ensure package alias have the package added")
     }
  }


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

    let packageDescriptor = ManifestHelpers.getPackageDescriptorFromConfig(sfdxPackage,projectConfig);

    if (projectConfig["packageAliases"]?.[sfdxPackage]) {
      return "Unlocked";
    } else {
      if (packageDescriptor.type?.toLowerCase() === "data")
        return "Data";
      else
        return "Source";
    }
  }

  public static getSFDXPackageDescriptor(
    projectDirectory: string,
    sfdxPackage: string
  ): any {

    let projectConfig = ManifestHelpers.getSFDXPackageManifest(
      projectDirectory
    );

    let sfdxPackageDescriptor = ManifestHelpers.getPackageDescriptorFromConfig(sfdxPackage, projectConfig);

    return sfdxPackageDescriptor;
  }

  public static getPackageDescriptorFromConfig(sfdxPackage: string, projectConfig: any) {
    let sfdxPackageDescriptor: any;

    if (!isNullOrUndefined(sfdxPackage)) {
      projectConfig["packageDirectories"].forEach((pkg) => {
        if (sfdxPackage == pkg["package"]) {
          sfdxPackageDescriptor = pkg;
        }
      });
    }

    if ( sfdxPackageDescriptor == null) {
      throw new Error("Package or package directory does not exist");
    }

    return sfdxPackageDescriptor;
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

}
