import { isNullOrUndefined } from "util";
import ManifestHelpers from "./ManifestHelpers";

let fs = require("fs-extra");
let path = require("path");

export type SourcePackageArtifact = {
    isDestructiveChangesFound?: boolean;
    destructiveChanges?: any;
    sourceDir: string;
    sfdxPackageDescriptor?:any;
  };
 
type DestructiveChanges = {
    isDestructiveChangesFound: boolean;
    destructiveChangesPath: string;
    destructiveChanges: any;
}

export default class SourcePackageGenerator {


  public static  generateSourcePackageArtifact(
    projectDirectory: string,
    sfdxPackage: string,
    destructiveManifestFilePath?: string
  ): SourcePackageArtifact {

 
    let result = <SourcePackageArtifact>{};
    let sfdxPackageDescriptor=ManifestHelpers.getSFDXPackageDescriptor(projectDirectory,sfdxPackage);
    let packageDirectory=sfdxPackageDescriptor["path"];


    let artifactDirectory, individualFilePath;
    if (!isNullOrUndefined(projectDirectory)) {
      artifactDirectory = path.join(projectDirectory, "source_package");
      individualFilePath = projectDirectory;
    } else {
      artifactDirectory = "source_package";
      individualFilePath = "";
    }

    //Create a new directory
    fs.mkdirsSync(path.join(artifactDirectory, packageDirectory));
    fs.writeFileSync(
      path.join(artifactDirectory, "sfdx-project.json"),
      JSON.stringify(
        ManifestHelpers.cleanupMPDFromManifest(projectDirectory, sfdxPackage)
      )
    );
    fs.copySync(
      path.join(individualFilePath, ".forceignore"),
      path.join(artifactDirectory, ".forceignore")
    );

    //First check if the task has a argument passed for destructive changes, as this takes precedence
    if (!isNullOrUndefined(destructiveManifestFilePath)) {
      fs.mkdirsSync(path.join(artifactDirectory, "destructive"));
      fs.copySync(
        path.join(individualFilePath, destructiveManifestFilePath),
        path.join(artifactDirectory, "destructive", "destructiveChanges.xml")
      );
    } // Try reading the manifest for any
    else {
      let destructiveManifestFromManifest = this.getDestructiveChanges(
        projectDirectory,
        packageDirectory
      );
      if (destructiveManifestFromManifest.isDestructiveChangesFound) {
        fs.mkdirsSync(path.join(artifactDirectory, "destructive"));
        result.isDestructiveChangesFound =
          destructiveManifestFromManifest.destructiveChanges;
        result.destructiveChanges =
          destructiveManifestFromManifest.destructiveChanges;
        fs.copySync(
          path.join(
            individualFilePath,
            destructiveManifestFromManifest.destructiveChangesPath
          ),
          path.join(artifactDirectory, "destructive", "destructiveChanges.xml")
        );
      }
    }

    fs.copySync(
      packageDirectory,
      path.join(artifactDirectory, packageDirectory)
    );

    result.sfdxPackageDescriptor=sfdxPackageDescriptor;
    result.sourceDir = artifactDirectory;
    return result;
  }


 
  private static getDestructiveChanges(
    projectDirectory: string,
    sfdxPackage: string
  ): DestructiveChanges {
    let destructiveChanges: any;
    let isDestructiveChangesFound: boolean = false;
    let destructiveChangesPath: string;

    let sfdxManifestPath: string;
    if (!isNullOrUndefined(projectDirectory)) {
      sfdxManifestPath = path.join(projectDirectory, "sfdx-project.json");
    } else {
      sfdxManifestPath = "sfdx-project.json";
    }

    let sfdxManifest = JSON.parse(fs.readFileSync(sfdxManifestPath, "utf8"));

    sfdxManifest["packageDirectories"].forEach((pkg) => {
      if (sfdxPackage == pkg["package"]) {
        if (pkg["destructiveChangePath"]) {
          try {
            destructiveChangesPath = pkg["destructiveChangePath"];
            destructiveChanges = JSON.parse(
              fs.readFileSync((pkg["destructiveChangePath"], "utf8"))
            );
            isDestructiveChangesFound = true;
          } catch (error) {
            console.warn(
              "Unable to read destructive Changes from the path specified in sfdx-project.json, This field will be ignored!"
            );
          }
        }
      }
    });
    return {
      isDestructiveChangesFound: isDestructiveChangesFound,
      destructiveChangesPath: destructiveChangesPath,
      destructiveChanges: destructiveChanges,
    };
  }
}
