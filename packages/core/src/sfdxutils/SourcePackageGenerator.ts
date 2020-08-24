import { isNullOrUndefined } from "util";
import ManifestHelpers from "./ManifestHelpers";
import * as rimraf from "rimraf";
let fs = require("fs-extra");
let path = require("path");

export type SourcePackageArtifact = {
  isDestructiveChangesFound?: boolean;
  destructiveChanges?: any;
  sourceDir: string;
  sfdxPackageDescriptor?: any;
};

type DestructiveChanges = {
  isDestructiveChangesFound: boolean;
  destructiveChangesPath: string;
  destructiveChanges: any;
};

export default class SourcePackageGenerator {
  public static generateSourcePackageArtifact(
    projectDirectory: string,
    sfdx_package: string,
    destructiveManifestFilePath?: string
  ): SourcePackageArtifact {
    let sourcePackageArtifact = <SourcePackageArtifact>{};


    let sfdxPackageDescriptor = ManifestHelpers.getSFDXPackageDescriptor(
      projectDirectory,
      sfdx_package
    );
    let packageDirectory = sfdxPackageDescriptor["path"];
    if(isNullOrUndefined(packageDirectory))
     {
       packageDirectory="";
      }

    let artifactDirectory, rootDirectory;
    if (!isNullOrUndefined(projectDirectory)) {
      artifactDirectory = path.join(projectDirectory, "source");
      rootDirectory = projectDirectory;
    } else {
      artifactDirectory = "source";
      rootDirectory = "";
    }

     

    //Ensure the directory is clean
    rimraf.sync(path.join(artifactDirectory, packageDirectory))

    //Create a new directory
    fs.mkdirsSync(path.join(artifactDirectory, packageDirectory));
    fs.writeFileSync(
      path.join(artifactDirectory, "sfdx-project.json"),
      JSON.stringify(
        ManifestHelpers.cleanupMPDFromManifest(projectDirectory, sfdx_package)
      )
    );
    fs.copySync(
      path.join(rootDirectory, ".forceignore"),
      path.join(artifactDirectory, ".forceignore")
    );

    //First check if the task has a argument passed for destructive changes, as this takes precedence
    if (!isNullOrUndefined(destructiveManifestFilePath)) {
      //Check whether the pased parameter is valid
      SourcePackageGenerator.copyDestructiveManifests(destructiveManifestFilePath, artifactDirectory, rootDirectory, sourcePackageArtifact);
    } 
    else {
      let destructiveManifestFromManifest = this.getDestructiveChanges(
        projectDirectory,
        packageDirectory
      );
      if (destructiveManifestFromManifest.isDestructiveChangesFound) {
        SourcePackageGenerator.copyDestructiveManifests(destructiveManifestFromManifest.destructiveChangesPath, artifactDirectory, rootDirectory, sourcePackageArtifact);
      }
    }

   
    fs.copySync(
      path.join(rootDirectory,packageDirectory),
      path.join(artifactDirectory, packageDirectory)
    );

    sourcePackageArtifact.sfdxPackageDescriptor = sfdxPackageDescriptor;
    sourcePackageArtifact.sourceDir = artifactDirectory;
    return sourcePackageArtifact;
  }

  private static copyDestructiveManifests(destructiveManifestFilePath: string, artifactDirectory: string, projectDirectory: any, sourcePackageArtifact: SourcePackageArtifact) {
    if (fs.existsSync(destructiveManifestFilePath)) {
      try {
        fs.mkdirsSync(path.join(artifactDirectory, "destructive"));
        fs.copySync(
          path.join(projectDirectory, destructiveManifestFilePath),
          path.join(artifactDirectory, "destructive", "destructiveChanges.xml")
        );

        sourcePackageArtifact.destructiveChanges = JSON.parse(
          fs.readFileSync(destructiveManifestFilePath, "utf8")
        );
        sourcePackageArtifact.isDestructiveChangesFound = true;
      }
      catch (error) {
        console.log("Unable to read/parse destructive manifest, Please check your artifacts, Will result in an error while deploying");
      }

    }
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
        
            destructiveChangesPath = pkg["destructiveChangePath"];
            destructiveChanges = JSON.parse(
              fs.readFileSync((pkg["destructiveChangePath"], "utf8"))
            );
            isDestructiveChangesFound = true;
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
