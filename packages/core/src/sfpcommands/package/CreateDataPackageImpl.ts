import PackageMetadata from "../../PackageMetadata";
import SourcePackageGenerator from "../../generators/SourcePackageGenerator";
import ProjectConfig from "../../project/ProjectConfig";
import SFPLogger, { FileLogger, LoggerLevel } from "../../logger/SFPLogger";
import * as fs from "fs-extra";
import { EOL } from "os";
import SFPStatsSender from "../../stats/SFPStatsSender";
import PackageEmptyChecker from "../../package/PackageEmptyChecker";
import path from "path";

export default class CreateDataPackageImpl {
  private packageLogger:FileLogger;

  public constructor(
    private projectDirectory: string,
    private sfdx_package: string,
    private packageArtifactMetadata: PackageMetadata,
    private breakBuildIfEmpty: boolean = true
  ) {
    fs.outputFileSync(
      `.sfpowerscripts/logs/${sfdx_package}`,
      `sfpowerscripts--log${EOL}`
    );
    this.packageLogger = new FileLogger(`.sfpowerscripts/logs/${sfdx_package}`);
  }

  public async exec(): Promise<PackageMetadata> {
    this.packageArtifactMetadata.package_type = "data";

    this.printHeader();

    let startTime = Date.now();

    //Get Package Descriptor
    let packageDescriptor = ProjectConfig.getSFDXPackageDescriptor(
      this.projectDirectory,
      this.sfdx_package
    );

    let packageDirectory: string = packageDescriptor["path"];

   
    this.validateDataPackage(packageDirectory);


    this.writeDeploymentStepsToArtifact(packageDescriptor);

    //Get Artifact Detailes
    let sourcePackageArtifactDir = SourcePackageGenerator.generateSourcePackageArtifact(
      this.packageLogger,
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


  private printHeader() {
    SFPLogger.log(
      "--------------Create Data Package---------------------------",
      null,
      this.packageLogger
    );
    SFPLogger.log(
      `Project Directory ${this.projectDirectory}`,
      LoggerLevel.INFO,
      this.packageLogger
    );
    SFPLogger.log(`sfdx_package ${this.sfdx_package}`, LoggerLevel.INFO, this.packageLogger);
    SFPLogger.log(
      `packageArtifactMetadata ${this.packageArtifactMetadata}`, LoggerLevel.INFO, this.packageLogger
    );
  }

  // Validate type of data package and existence of the correct configuration files 
  private validateDataPackage(packageDirectory: string) {

    if (PackageEmptyChecker.isEmptyDataPackage(this.projectDirectory, packageDirectory)) {

      if (this.breakBuildIfEmpty)
        throw new Error(`Package directory ${packageDirectory} is empty`);
      else
        this.printEmptyArtifactWarning();
    }

    if (fs.pathExistsSync(path.join(this.projectDirectory, packageDirectory, "export.json"))) {
      SFPLogger.log(
        `Found export.json in ${packageDirectory}.. Utilizing it as data package and will be deployed using sfdmu`,
        LoggerLevel.INFO,
        this.packageLogger
      );
    }
    else if (fs.pathExistsSync(path.join(this.projectDirectory, packageDirectory, "VlocityComponents.yaml"))) {
      SFPLogger.log(
        `Found VlocityComponents.yaml in ${packageDirectory}.. Utilizing it as data package and will be deployed using vbt`,
        LoggerLevel.INFO,
        this.packageLogger
      );
    }
    else {
      throw new Error(`Could not find export.json or VlocityComponents.yaml in ${packageDirectory}. sfpowerscripts only support vlocity or sfdmu based data packages`);
    }
  }

  private writeDeploymentStepsToArtifact(packageDescriptor: any) {

    if (packageDescriptor.assignPermSetsPreDeployment) {
      if (packageDescriptor.assignPermSetsPreDeployment instanceof Array)
        this.packageArtifactMetadata.assignPermSetsPreDeployment = packageDescriptor
          .assignPermSetsPreDeployment;

      else
        throw new Error("Property 'assignPermSetsPreDeployment' must be of type array");
    }


    if (packageDescriptor.assignPermSetsPostDeployment) {
      if (packageDescriptor.assignPermSetsPostDeployment instanceof Array)
        this.packageArtifactMetadata.assignPermSetsPostDeployment = packageDescriptor
          .assignPermSetsPostDeployment;

      else
        throw new Error("Property 'assignPermSetsPostDeployment' must be of type array");
    }
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
