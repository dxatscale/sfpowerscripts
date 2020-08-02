import { isNullOrUndefined } from "util";
import getMDAPIPackageFromSourceDirectory from "../getMdapiPackage";
let fs = require("fs-extra");
let path = require("path");

export default class CreateSourcePackageImpl {
  public constructor(
    private projectDirectory: string,
    private sfdxPackage: string,
    private destructiveManifestFilePath:string
  ) {}

  public async exec(): Promise<{ isApexFound:boolean,isDestructiveChangesFound:boolean, mdapiDir: string; manifestAsJSON: any }> {
    let packageDirectory: string = this.getPackageDirectory(this.projectDirectory,this.sfdxPackage);

    console.log("Package Directory",packageDirectory);

    let mdapiPackage = await getMDAPIPackageFromSourceDirectory(
      this.projectDirectory,
      packageDirectory
    );
   
    let isApexFound=false;
    for (let type of mdapiPackage["manifestAsJSON"]["Package"]["types"]) {
      if (type["name"] == "ApexClass" || type["name"]=="ApexTrigger") {
        isApexFound=true;
        break;
      }
    }

    let artifactDirectory=this.copySourcePackageToArtifact(this.projectDirectory,packageDirectory);

    let isDestructiveChangesFound=false
    if(!isNullOrUndefined(this.destructiveManifestFilePath))
    isDestructiveChangesFound=true

    return {isApexFound:isApexFound,isDestructiveChangesFound:isDestructiveChangesFound,mdapiDir:artifactDirectory,manifestAsJSON:mdapiPackage.manifestAsJSON}
  }

  private copySourcePackageToArtifact(projectDirectory:string, packageDirectory: string):string
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


    if(!isNullOrUndefined(this.destructiveManifestFilePath))
    fs.copySync(path.join(individualFilePath,this.destructiveManifestFilePath),path.join(artifactDirectory,"destructive","destructiveChanges.xml"));
    
    fs.copySync(packageDirectory,path.join(artifactDirectory,packageDirectory));
    
  return artifactDirectory;
  }

  private getPackageDirectory(projectDirectory:string,sfdxPackage:string): string {
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


