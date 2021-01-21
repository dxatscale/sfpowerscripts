import * as fs from "fs-extra";
let path = require("path");

/**
 * Helper functions for retrieving info from project config
 */
export default class ProjectConfig {

  /**
   * Returns 0H Id of package from project config
   * @param projectConfig
   * @param sfdxPackage
   */
  public static getPackageId(projectConfig: any, sfdxPackage: string) {
     if (projectConfig["packageAliases"]?.[sfdxPackage]) {
       return projectConfig["packageAliases"][sfdxPackage]
     }
     else
     {
       throw Error("No Package Id found in sfdx-project.json. Please ensure package alias have the package added");
     }
  }

  /**
   * Returns package names, as an array of strings
   * @param projectDirectory
   */
  public static getAllPackages(projectDirectory: string): string[] {
    let projectConfig = ProjectConfig.getSFDXPackageManifest(projectDirectory);
    let sfdxpackages=[];
    projectConfig["packageDirectories"].forEach((pkg) => {
     sfdxpackages.push(pkg["package"]);
    });
    return sfdxpackages;
  }

  /**
   * Returns package manifest as JSON object
   * @param projectDirectory
   */
  public static getSFDXPackageManifest(projectDirectory: string): any {
    let projectConfigJSON: string;

    if (projectDirectory) {
      projectConfigJSON = path.join(projectDirectory, "sfdx-project.json");
    } else {
      projectConfigJSON = "sfdx-project.json";
    }

    try {
      return JSON.parse(fs.readFileSync(projectConfigJSON, "utf8"));
    } catch(error) {
      throw new Error(
        `sfdx-project.json doesn't exist or not readable at ${projectConfigJSON}`
      );
    }
  }

  /**
   * Returns type of package
   * @param projectConfig
   * @param sfdxPackage
   */
  public static getPackageType(
    projectConfig:any,
    sfdxPackage: string
  ): "Unlocked" | "Data" | "Source" {

    let packageDescriptor = ProjectConfig.getPackageDescriptorFromConfig(sfdxPackage,projectConfig);

    if (projectConfig["packageAliases"]?.[sfdxPackage]) {
      return "Unlocked";
    } else {
      if (packageDescriptor.type?.toLowerCase() === "data")
        return "Data";
      else
        return "Source";
    }
  }

  /**
   * Returns package descriptor from package manifest at project directory
   * @param projectDirectory
   * @param sfdxPackage
   */
  public static getSFDXPackageDescriptor(
    projectDirectory: string,
    sfdxPackage: string
  ): any {

    let projectConfig = ProjectConfig.getSFDXPackageManifest(
      projectDirectory
    );

    let sfdxPackageDescriptor = ProjectConfig.getPackageDescriptorFromConfig(sfdxPackage, projectConfig);

    return sfdxPackageDescriptor;
  }

  /**
   * Returns package descriptor from project config JSON object
   * @param sfdxPackage
   * @param projectConfig
   */
  public static getPackageDescriptorFromConfig(sfdxPackage: string, projectConfig: any) {
    let sfdxPackageDescriptor: any;

    if (sfdxPackage) {
      projectConfig["packageDirectories"].forEach((pkg) => {
        if (sfdxPackage == pkg["package"]) {
          sfdxPackageDescriptor = pkg;
        }
      });
    }

    if (sfdxPackageDescriptor == null)
      throw new Error("Package or package directory does not exist");

    return sfdxPackageDescriptor;
  }

  /**
   * Returns descriptor of default package
   * @param projectDirectory
   */
  public static getDefaultSFDXPackageDescriptor(projectDirectory: string): any {
    let packageDirectory: string;
    let sfdxPackageDescriptor: any;

    let projectConfig = this.getSFDXPackageManifest(projectDirectory);

    //Return the default package directory
    projectConfig["packageDirectories"].forEach((pkg) => {
      if (pkg["default"] == true) {
        packageDirectory = pkg["path"];
        sfdxPackageDescriptor = pkg;
      }
    });

    if (packageDirectory == null)
      throw new Error("Package or package directory not exist");
    else return sfdxPackageDescriptor;
  }

  /**
   * Returns pruned package manifest, containing sfdxPackage only
   * @param projectDirectory
   * @param sfdxPackage
   */
  public static cleanupMPDFromManifest(
    projectDirectory: string,
    sfdxPackage: string
  ): any {
    let sfdxManifest = this.getSFDXPackageManifest(projectDirectory);

    if (sfdxPackage) {
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
