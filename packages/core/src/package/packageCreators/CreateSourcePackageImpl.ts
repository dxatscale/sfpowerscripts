import SFPLogger, { FileLogger, LoggerLevel, Logger } from "../../logger/SFPLogger";
import PackageMetadata from "../../PackageMetadata";
import SourcePackageGenerator from "../../generators/SourcePackageGenerator";
import ProjectConfig from "../../project/ProjectConfig";
import { EOL } from "os";
import * as fs from "fs-extra";
import path = require("path");
import  { ApexSortedByType, FileDescriptor } from "../../apex/parser/ApexTypeFetcher";
import SFPStatsSender from "../../stats/SFPStatsSender";
import PackageEmptyChecker from "../PackageEmptyChecker";
import SFPPackage  from "../SFPPackage";
const Table = require("cli-table");

export default class CreateSourcePackageImpl {

  public constructor(
    private projectDirectory: string,
    private sfdx_package: string,
    private packageArtifactMetadata: PackageMetadata,
    private pathToReplacementForceIgnore?: string,
    private breakBuildIfEmpty: boolean = true,
    private packageLogger?: Logger
  ) {
    if (!this.packageLogger) {
      fs.outputFileSync(
        `.sfpowerscripts/logs/${sfdx_package}`,
        `sfpowerscripts--log${EOL}`
      );
      this.packageLogger = new FileLogger(`.sfpowerscripts/logs/${sfdx_package}`);
    }
  }

  public async exec(): Promise<PackageMetadata> {
    //Only set package type to source if its not provided, delta will be setting it up
    if (
      this.packageArtifactMetadata.package_type === null ||
      this.packageArtifactMetadata.package_type === undefined
    )
      this.packageArtifactMetadata.package_type = "source";

    SFPLogger.log(
      "--------------Create Source Package---------------------------",
      LoggerLevel.INFO,
      this.packageLogger
    );
    SFPLogger.log(
      `Project Directory: ${this.projectDirectory}`,LoggerLevel.INFO,
      this.packageLogger
    );
    SFPLogger.log(`sfdx_package: ${this.sfdx_package}`,LoggerLevel.INFO ,this.packageLogger);

    SFPLogger.log(
      `packageArtifactMetadata: ${JSON.stringify(this.packageArtifactMetadata)}`,
      LoggerLevel.INFO,
      this.packageLogger
    );

    let startTime = Date.now();

    //Get Package Descriptor
    let packageDescriptor, packageDirectory: string;
    if (this.sfdx_package!=null) {
      packageDescriptor = ProjectConfig.getSFDXPackageDescriptor(
        this.projectDirectory,
        this.sfdx_package
      );
      packageDirectory = packageDescriptor["path"];
    }

    //Get the contents of the package
    let sfppackage:SFPPackage;

    let isBuildSfpPackage: boolean = true;
    if (!this.breakBuildIfEmpty) {
      // Check whether forceignores will result in empty directory
      let isEmpty: boolean = PackageEmptyChecker.isEmptyFolder(
        this.projectDirectory,
        packageDirectory
      );

      if(isEmpty) {
        // Do not build SfpPackage, as it would cause the build to break
        isBuildSfpPackage = false;
        this.printEmptyArtifactWarning();
      }
    }

    if (isBuildSfpPackage) {
      sfppackage = await SFPPackage.buildPackageFromProjectConfig(
        this.packageLogger,
        this.projectDirectory,
        this.sfdx_package,
        null,
        this.pathToReplacementForceIgnore
      );

      this.packageArtifactMetadata.payload = sfppackage.payload;
      this.packageArtifactMetadata.metadataCount = sfppackage.metadataCount;
      this.packageArtifactMetadata.isApexFound = sfppackage.isApexInPackage
      this.packageArtifactMetadata.isProfilesFound = sfppackage.isProfilesInPackage;
      this.packageArtifactMetadata.assignPermSetsPreDeployment = sfppackage.assignPermSetsPreDeployment;
      this.packageArtifactMetadata.assignPermSetsPostDeployment = sfppackage.assignPermSetsPostDeployment;
      this.packageArtifactMetadata.reconcileProfiles = sfppackage.reconcileProfiles;

      if (sfppackage.destructiveChanges) {
        this.packageArtifactMetadata.destructiveChanges = sfppackage.destructiveChanges;
      }

      this.handleApexTestClasses(sfppackage);
    }


    //Get Artifact Details
    let sourcePackageArtifactDir = SourcePackageGenerator.generateSourcePackageArtifact(
      this.packageLogger,
      this.projectDirectory,
      this.sfdx_package,
      packageDirectory,
      sfppackage?.destructiveChangesPath,
      null,
      this.pathToReplacementForceIgnore
    );

    this.packageArtifactMetadata.sourceDir = sourcePackageArtifactDir;

    //Add Timestamps
    let endTime = Date.now();
    let elapsedTime = endTime - startTime;
    this.packageArtifactMetadata.creation_details = {
      creation_time: elapsedTime,
      timestamp: Date.now(),
    };


    SFPStatsSender.logGauge(
      "package.metadatacount",
      this.packageArtifactMetadata.metadataCount,
      {
        package: this.packageArtifactMetadata.package_name,
        type: this.packageArtifactMetadata.package_type
      }
    );
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


  /**
   * Replaces root forceignore in the source folder with the appropriate stage forceignore
   * @param pathToSourceFolder
   * @param forceignorePath
   */
  private replaceRootForceIgnore(pathToSourceFolder: string, stageForceIgnorePath: string) {
    if (fs.existsSync(path.join(pathToSourceFolder, stageForceIgnorePath)))
      fs.copySync(
        path.join(pathToSourceFolder, stageForceIgnorePath),
        path.join(pathToSourceFolder, ".forceignore")
      );
    else {
      SFPLogger.log(`${path.join(pathToSourceFolder, stageForceIgnorePath)} does not exist`, LoggerLevel.INFO, this.packageLogger);
      SFPLogger.log("Package creation will continue using the unchanged forceignore in the root directory", LoggerLevel.INFO, this.packageLogger);
    }
  }

  private handleApexTestClasses(mdapiPackage: SFPPackage) {

    let classTypes:ApexSortedByType = mdapiPackage.apexClassesSortedByTypes;

    if (!this.packageArtifactMetadata.isTriggerAllTests) {
      if (
        this.packageArtifactMetadata.isApexFound &&
        classTypes?.testClass?.length == 0
      ) {
        this.printSlowDeploymentWarning();
        this.packageArtifactMetadata.isTriggerAllTests = true;
      } else if (
        this.packageArtifactMetadata.isApexFound &&
        classTypes?.testClass?.length > 0
      ) {
        if (classTypes?.parseError?.length > 0) {
          SFPLogger.log(
            "---------------------------------------------------------------------------------------",
            LoggerLevel.INFO,
            this.packageLogger
          );
          SFPLogger.log(
            "Unable to parse these classes to correctly identify test classes, Its not your issue, its ours! Please raise a issue in our repo!",
            LoggerLevel.INFO,
            this.packageLogger
          );
          this.printClassesIdentified(classTypes?.parseError);
          this.packageArtifactMetadata.isTriggerAllTests = true;
        } else {
          this.printHintForOptimizedDeployment();
          this.packageArtifactMetadata.isTriggerAllTests = false;
          this.printClassesIdentified(classTypes?.testClass);
          this.packageArtifactMetadata.apexTestClassses = [];
          classTypes?.testClass.forEach((element) => {
            this.packageArtifactMetadata.apexTestClassses.push(element.name);
          });
        }
      }
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
      LoggerLevel.INFO,
      this.packageLogger
    );
  }

  private printHintForOptimizedDeployment() {
    SFPLogger.log(
      `---------------- OPTION FOR DEPLOYMENT OPTIMIZATION AVAILABLE-----------------------------------`,
      null,
      this.packageLogger
    );
    SFPLogger.log(
      `Following apex test classes were identified and can  be used for deploying this package,${EOL}` +
        `in an optimal manner, provided each individual class meets the test coverage requirement of 75% and above${EOL}` +
        `Ensure each apex class/trigger is validated for coverage in the validation stage`,
      null,
      this.packageLogger
    );
    SFPLogger.log(
      `-----------------------------------------------------------------------------------------------`,
      LoggerLevel.INFO,
      this.packageLogger
    );
  }

  private printSlowDeploymentWarning() {
    SFPLogger.log(
      `-------WARNING! YOU MIGHT NOT BE ABLE TO DEPLOY OR WILL HAVE A SLOW DEPLOYMENT---------------`,
      LoggerLevel.INFO,
      this.packageLogger
    );
    SFPLogger.log(
      `This package has apex classes/triggers, however apex test classes were not found, You would not be able to deploy${EOL}` +
        `to production org optimally if each class do not have coverage of 75% and above,We will attempt deploying${EOL}` +
        `this package by triggering all local tests in the org which could be realy costly in terms of deployment time!${EOL}`,
      null,
      this.packageLogger
    );
    SFPLogger.log(
      `---------------------------------------------------------------------------------------------`,
      LoggerLevel.INFO,
      this.packageLogger
    );
  }

  private printClassesIdentified(fetchedClasses: FileDescriptor[]) {
    if (fetchedClasses === null || fetchedClasses === undefined) return;

    let table = new Table({
      head: ["Class", "Path", "Error"],
    });

    for (let fetchedClass of fetchedClasses) {
      let item = [
        fetchedClass.name,
        fetchedClass.filepath,
        fetchedClass.error ? JSON.stringify(fetchedClass.error) : "N/A",
      ];
      table.push(item);
    }
    SFPLogger.log(
      "Following apex test classes were identified",
      LoggerLevel.INFO,
      this.packageLogger
    );
    SFPLogger.log(table.toString(), LoggerLevel.INFO, this.packageLogger);
  }
}
