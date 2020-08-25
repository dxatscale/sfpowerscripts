import PackageMetadata from "../sfdxwrappers/PackageMetadata";
import SourcePackageGenerator from "../sfdxutils/SourcePackageGenerator";
import ManifestHelpers from "../sfdxutils/ManifestHelpers";
import MDAPIPackageGenerator from "../sfdxutils/MDAPIPackageGenerator";
import { isNullOrUndefined } from "util";

export default class CreateSourcePackageImpl {
  public constructor(
    private projectDirectory: string,
    private sfdx_package: string,
    private destructiveManifestFilePath: string,
    private packageArtifactMetadata: PackageMetadata
  ) {}

  public async exec(): Promise<PackageMetadata> {
    console.log(
      "--------------Create Source Package---------------------------"
    );
    console.log("Project Directory", this.projectDirectory);
    console.log("sfdx_package", this.sfdx_package);
    console.log(
      "destructiveManifestFilePath",
      this.destructiveManifestFilePath
    );
    console.log("packageArtifactMetadata", this.packageArtifactMetadata);

    this.packageArtifactMetadata.package_type = "source";

    let startTime = Date.now();
    let packageDirectory: string = ManifestHelpers.getSFDXPackageDescriptor(
      this.projectDirectory,
      this.sfdx_package
    )["path"];
    console.log("Package Directory", packageDirectory);

    //Convert to MDAPI to get PayLoad
    let mdapiPackage;
    if (!isNullOrUndefined(packageDirectory)) {
      //Check whether forceignores will result in empty directory
      let isEmpty: boolean = MDAPIPackageGenerator.isEmptyFolder(
        this.projectDirectory,
        packageDirectory
      );

      if (!isEmpty) {
        mdapiPackage = await MDAPIPackageGenerator.getMDAPIPackageFromSourceDirectory(
          this.projectDirectory,
          packageDirectory
        );

        this.packageArtifactMetadata.payload = mdapiPackage.manifestAsJSON;

        let isApexFound = false;
        if (Array.isArray(mdapiPackage.manifestAsJSON["Package"]["types"])) {
          for (let type of mdapiPackage.manifestAsJSON["Package"]["types"]) {
            if (type["name"] == "ApexClass" || type["name"] == "ApexTrigger") {
              isApexFound = true;
              break;
            }
          }
        } else if (
          mdapiPackage.manifestAsJSON["Package"]["types"]["name"] ==
            "ApexClass" ||
          mdapiPackage.manifestAsJSON["Package"]["types"]["name"] ==
            "ApexTrigger"
        ) {
          isApexFound = true;
        }
        this.packageArtifactMetadata.isApexFound = isApexFound;
      } else {
        console.log("---------------------WARNING! Empty aritfact encountered-------------------------------");
        console.log("Either this folder is empty or the application of .forceignore results in an empty folder");
        console.log("Proceeding to create an empty artifact");
        console.log("---------------------------");
      }
    } else {
      console.log(
        "Proceeding with all packages.. as a particular package was not provided"
      );
    }

    //Get Artifact Details
    let sourcePackageArtifact = SourcePackageGenerator.generateSourcePackageArtifact(
      this.projectDirectory,
      this.sfdx_package,
      this.destructiveManifestFilePath
    );

    this.packageArtifactMetadata.sourceDir = sourcePackageArtifact.sourceDir;
    this.packageArtifactMetadata.isDestructiveChangesFound =
      sourcePackageArtifact.isDestructiveChangesFound;
    this.packageArtifactMetadata.destructiveChanges =
      sourcePackageArtifact.destructiveChanges;

    //Add Timestamps
    let endTime = Date.now();
    let elapsedTime = endTime - startTime;
    this.packageArtifactMetadata.creation_details = {
      creation_time: elapsedTime,
      timestamp: Date.now(),
    };
    return this.packageArtifactMetadata;
  }
}
