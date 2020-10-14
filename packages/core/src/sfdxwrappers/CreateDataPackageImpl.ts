import PackageMetadata from "../PackageMetadata";
import SourcePackageGenerator from "../generators/SourcePackageGenerator";
import ManifestHelpers from "../manifest/ManifestHelpers";
import MDAPIPackageGenerator from "../generators/MDAPIPackageGenerator";
import { isNullOrUndefined } from "util";
import { EOL } from "os";

const fs = require("fs-extra");
import path = require("path");
import ApexTypeFetcher, { FileDescriptor } from "../parser/ApexTypeFetcher";
const Table = require("cli-table");

export default class CreateDataPackageImpl {
  public constructor(
    private projectDirectory: string,
    private sfdx_package: string,
    private packageArtifactMetadata: PackageMetadata
  ) {}

  public async exec(): Promise<PackageMetadata> {
    console.log(
      "--------------Create Data Package---------------------------"
    );
    console.log("Project Directory", this.projectDirectory);
    console.log("sfdx_package", this.sfdx_package);
    console.log("packageArtifactMetadata", this.packageArtifactMetadata);

    let startTime = Date.now();

    //Get Package Descriptor
    let packageDescriptor, packageDirectory: string;
    if (this.sfdx_package != null) {
      packageDescriptor = ManifestHelpers.getSFDXPackageDescriptor(
        this.projectDirectory,
        this.sfdx_package
      );
      packageDirectory = packageDescriptor["path"];
      this.packageArtifactMetadata.preDeploymentSteps = packageDescriptor[
        "preDeploymentSteps"
      ]?.split(",");
      this.packageArtifactMetadata.postDeploymentSteps = packageDescriptor[
        "postDeploymentSteps"
      ]?.split(",");
    }


    //Get Artifact Detailes
    let sourcePackageArtifactDir = SourcePackageGenerator.generateSourcePackageArtifact(
      this.projectDirectory,
      this.sfdx_package,
      packageDirectory
    );

    this.packageArtifactMetadata.sourceDir = sourcePackageArtifactDir;

    //Add Timestamps
    let endTime = Date.now();
    let elapsedTime = endTime - startTime;
    this.packageArtifactMetadata.creation_details = {
      creation_time: elapsedTime,
      timestamp: Date.now(),
    };
    return this.packageArtifactMetadata;
  }

  private printEmptyArtifactWarning() {
    console.log(
      "---------------------WARNING! Empty aritfact encountered-------------------------------"
    );
    console.log(
      "Either this folder is empty or the application of .forceignore results in an empty folder"
    );
    console.log("Proceeding to create an empty artifact");
    console.log(
      "---------------------------------------------------------------------------------------"
    );
  }
}
