import PackageMetadata from "../PackageMetadata";
import SourcePackageGenerator from "../generators/SourcePackageGenerator";
import ManifestHelpers from "../manifest/ManifestHelpers";
import MDAPIPackageGenerator from "../generators/MDAPIPackageGenerator";
import SFPLogger from "../utils/SFPLogger";
import * as fs from "fs-extra";
import { EOL } from "os";
import SFPStatsSender from "../utils/SFPStatsSender";

export default class CreateDataPackageImpl {
  private packageLogger;

  public constructor(
    private projectDirectory: string,
    private sfdx_package: string,
    private packageArtifactMetadata: PackageMetadata
  ) {
    fs.outputFileSync(
      `.sfpowerscripts/logs/${sfdx_package}`,
      `sfpowerscripts--log${EOL}`
    );
    this.packageLogger = `.sfpowerscripts/logs/${sfdx_package}`;
  }

  public async exec(): Promise<PackageMetadata> {
    this.packageArtifactMetadata.package_type = "data";

    SFPLogger.log(
      "--------------Create Data Package---------------------------",
      null,
      this.packageLogger
    );
    SFPLogger.log(
      "Project Directory",
      this.projectDirectory,
      this.packageLogger
    );
    SFPLogger.log("sfdx_package", this.sfdx_package, this.packageLogger);
    SFPLogger.log(
      "packageArtifactMetadata",
      this.packageArtifactMetadata,
      this.packageLogger
    );

    let startTime = Date.now();

    //Get Package Descriptor
    let packageDescriptor = ManifestHelpers.getSFDXPackageDescriptor(
      this.projectDirectory,
      this.sfdx_package
    );

    let packageDirectory: string = packageDescriptor["path"];

    this.packageArtifactMetadata.preDeploymentSteps = packageDescriptor[
      "preDeploymentSteps"
    ]?.split(",");
    this.packageArtifactMetadata.postDeploymentSteps = packageDescriptor[
      "postDeploymentSteps"
    ]?.split(",");

    this.packageArtifactMetadata.permissionSetsToAssign = packageDescriptor
        .permissionSetsToAssign?.split(",");

    if (
      MDAPIPackageGenerator.isEmptyFolder(
        this.projectDirectory,
        packageDirectory
      )
    ) {
      this.printEmptyArtifactWarning();
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

    SFPStatsSender.logElapsedTime(
      "package.elapsed.time",
      this.packageArtifactMetadata.creation_details.creation_time,
      {
        package: this.packageArtifactMetadata.package_name,
        type: this.packageArtifactMetadata.package_type,
        is_dependency_validated: "false"
      }
    );
    SFPStatsSender.logCount("package.created", {
      package: this.packageArtifactMetadata.package_name,
      type: this.packageArtifactMetadata.package_type,
      is_dependency_validated: "false"
    });

    return this.packageArtifactMetadata;
  }

  private printEmptyArtifactWarning() {
    SFPLogger.log(
      "---------------------WARNING! Empty aritfact encountered-------------------------------",
      null,
      this.packageLogger
    );
    SFPLogger.log(
      "Either this folder is empty or the application of .forceignore results in an empty folder",
      null,
      this.packageLogger
    );
    SFPLogger.log(
      "Proceeding to create an empty artifact",
      null,
      this.packageLogger
    );
    SFPLogger.log(
      "---------------------------------------------------------------------------------------",
      null,
      this.packageLogger
    );
  }
}
