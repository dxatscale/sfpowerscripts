import PackageMetadata from "../sfdxwrappers/PackageMetadata";
import SourcePackageGenerator from "../sfdxutils/SourcePackageGenerator";
import ManifestHelpers from "../sfdxutils/ManifestHelpers";
import MDAPIPackageGenerator from "../sfdxutils/MDAPIPackageGenerator"


export default class CreateSourcePackageImpl {


  public constructor(
    private projectDirectory: string,
    private sfdxPackage: string,
    private destructiveManifestFilePath:string,
    private packageArtifactMetadata:PackageMetadata
  ) {}

  public async exec(): Promise<PackageMetadata> {


    this.packageArtifactMetadata.package_type= "source";


    let startTime = Date.now();
    let packageDirectory: string = ManifestHelpers.getSFDXPackageDescriptor(this.projectDirectory,this.sfdxPackage)["path"];
    console.log("Package Directory",packageDirectory);

    //Convert to MDAPI to get PayLoad
    let mdapiPackage = await MDAPIPackageGenerator.getMDAPIPackageFromSourceDirectory(
      this.projectDirectory,
      packageDirectory
    );
    this.packageArtifactMetadata.payload=mdapiPackage.manifestAsJSON;
    
    let isApexFound=false;
    if(Array.isArray(mdapiPackage.manifestAsJSON["Package"]["types"]))
    {
    for (let type of mdapiPackage.manifestAsJSON["Package"]["types"]) {
      if (type["name"] == "ApexClass" || type["name"]=="ApexTrigger") {
        isApexFound=true;
        break;
      }
     }
    }
    else if( mdapiPackage.manifestAsJSON["Package"]["types"]["name"] == "ApexClass" ||  mdapiPackage.manifestAsJSON["Package"]["types"]["name"] == "ApexTrigger" )
    {
      isApexFound=true;
    }
    this.packageArtifactMetadata.isApexFound=isApexFound;


    //Get Artifact Details
    let sourcePackageArtifact=SourcePackageGenerator.generateSourcePackageArtifact(this.projectDirectory,this.sfdxPackage,this.destructiveManifestFilePath);

    this.packageArtifactMetadata.sourceDir=sourcePackageArtifact.sourceDir;
    this.packageArtifactMetadata.isDestructiveChangesFound=sourcePackageArtifact.isDestructiveChangesFound;
    this.packageArtifactMetadata.destructiveChanges=sourcePackageArtifact.destructiveChanges;

    //Add Timestamps
    let endTime = Date.now();
    let elapsedTime = endTime-startTime;
    this.packageArtifactMetadata.creation_details = {
      creation_time: elapsedTime,
      timestamp:Date.now()
    }
    return this.packageArtifactMetadata;
  }

  
 
}


