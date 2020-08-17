import { isNullOrUndefined } from "util";
import getMDAPIPackageFromSourceDirectory from "../getMdapiPackage";
import PackageMetadata from "../sfdxwrappers/PackageMetadata";
import { performance } from "perf_hooks";
let fs = require("fs-extra");
let path = require("path");

export default class CreateSourcePackageImpl {


  public constructor(
    private projectDirectory: string,
    private sfdxPackage: string,
    private destructiveManifestFilePath:string,
    private packageArtifactMetadata:PackageMetadata
  ) {}

  public async exec(): Promise<PackageMetadata> {

    let startTime = Date.now();
    let packageDirectory: string = this.getPackageDirectory(this.projectDirectory,this.sfdxPackage);
    console.log("Package Directory",packageDirectory);
    let mdapiPackage = await getMDAPIPackageFromSourceDirectory(
      this.projectDirectory,
      packageDirectory
    );

    this.packageArtifactMetadata.payload=mdapiPackage.manifestAsJSON;
    let isApexFound=false;
    for (let type of mdapiPackage["manifestAsJSON"]["Package"]["types"]) {
      if (type["name"] == "ApexClass" || type["name"]=="ApexTrigger") {
        isApexFound=true;
        break;
      }
    }
    this.packageArtifactMetadata.isApexFound=isApexFound;


    //Get Artifact Details
    this.generateSourcePackageArtifact(this.projectDirectory,packageDirectory);

    //Add Timestamps
    let endTime = Date.now();
    let elapsedTime = endTime-startTime;
    this.packageArtifactMetadata.creation_details = {
      creation_time: elapsedTime,
      timestamp:Date.now()
    }
    return this.packageArtifactMetadata;
  }

  private generateSourcePackageArtifact(projectDirectory:string, packageDirectory: string)
  {
    let artifactDirectory, individualFilePath;
    if (!isNullOrUndefined(projectDirectory)) {
      artifactDirectory = path.join(projectDirectory, "source_package");
      individualFilePath = projectDirectory;
    } else {
      artifactDirectory = "source_package";
      individualFilePath="";
    }
    
    //Create a new directory
    fs.mkdirsSync(path.join(artifactDirectory,packageDirectory));
    fs.writeFileSync(path.join(artifactDirectory,"sfdx-project.json"), JSON.stringify(this.cleanupMPDFromManifest(projectDirectory,this.sfdxPackage)))
    fs.copySync(path.join(individualFilePath,".forceignore"),path.join(artifactDirectory,".forceignore"));


    //First check if the task has a argument passed for destructive changes, as this takes precedence
    if(!isNullOrUndefined(this.destructiveManifestFilePath))
    {
    fs.copySync(path.join(individualFilePath,this.destructiveManifestFilePath),path.join(artifactDirectory,"destructive","destructiveChanges.xml"));

    }
    else // Try reading the manifest for any
    {
      let destructiveManifestFromManifest=this.getDestructiveChanges(this.projectDirectory,packageDirectory);
      if(destructiveManifestFromManifest.isDestructiveChangesFound)
      {
      this.packageArtifactMetadata.isDestructiveChangesFound=destructiveManifestFromManifest.destructiveChanges;
      this.packageArtifactMetadata.destructiveChanges=destructiveManifestFromManifest.destructiveChanges;
      fs.copySync(path.join(individualFilePath,destructiveManifestFromManifest.destructiveChangesPath),path.join(artifactDirectory,"destructive","destructiveChanges.xml"));
      }
    }
    
    fs.copySync(packageDirectory,path.join(artifactDirectory,packageDirectory));
    
    this.packageArtifactMetadata.sourceDir=artifactDirectory;
  }

  private getPackageDirectory(projectDirectory:string,sfdxPackage:string): any {
    let packageDirectory: string;

    let projectConfig: string;
    if (!isNullOrUndefined(projectDirectory)) {
      projectConfig = path.join(projectDirectory, "sfdx-project.json");
    } else {
      projectConfig = "sfdx-project.json";
    }

    let projectJson = JSON.parse(fs.readFileSync(projectConfig, "utf8"));

    projectJson["packageDirectories"].forEach((pkg) => {
      if (sfdxPackage == pkg["package"]) packageDirectory = pkg["path"];
    });

    if (isNullOrUndefined(packageDirectory))
      throw new Error("Package or package directory not exist");
    else return packageDirectory;
  }

  private getDestructiveChanges(projectDirectory:string,sfdxPackage:string): {isDestructiveChangesFound:boolean;destructiveChangesPath:string;destructiveChanges:any} {
    let destructiveChanges: any;
    let isDestructiveChangesFound:boolean=false;
    let destructiveChangesPath:string;

    let projectConfig: string;
    if (!isNullOrUndefined(projectDirectory)) {
      projectConfig = path.join(projectDirectory, "sfdx-project.json");
    } else {
      projectConfig = "sfdx-project.json";
    }

    let projectJson = JSON.parse(fs.readFileSync(projectConfig, "utf8"));

    projectJson["packageDirectories"].forEach((pkg) => {
      if (sfdxPackage == pkg["package"]) 
      {
        if(pkg["destructiveChangePath"])
        {
          try
          {
          destructiveChangesPath=pkg["destructiveChangePath"];
          destructiveChanges = JSON.parse(fs.readFileSync((pkg["destructiveChangePath"], "utf8")));
          isDestructiveChangesFound=true;
          }
          catch(error)
          {
            console.warn("Unable to read destructive Changes from the path specified in sfdx-project.json, This field will be ignored!");
          }
        }
      }
    });
   return {isDestructiveChangesFound:isDestructiveChangesFound,destructiveChangesPath:destructiveChangesPath,destructiveChanges:destructiveChanges};
  }

  private cleanupMPDFromManifest(projectDirectory:string,sfdxPackage:string): any {
 
    let projectConfig: string;
    if (!isNullOrUndefined(projectDirectory)) {
      projectConfig = path.join(projectDirectory, "sfdx-project.json");
    } else {
      projectConfig = "sfdx-project.json";
    }

    let sfdxManifest = JSON.parse(fs.readFileSync(projectConfig, "utf8"));
    let i = sfdxManifest["packageDirectories"].length
    while (i--) {
    if (sfdxPackage !=  sfdxManifest["packageDirectories"][i]["package"]) { 
      sfdxManifest["packageDirectories"].splice(i, 1);
    } 
   }
      return sfdxManifest;
  }

}


