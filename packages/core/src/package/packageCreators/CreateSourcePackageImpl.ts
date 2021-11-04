import SFPLogger, { LoggerLevel, Logger } from "../../logger/SFPLogger";
import PackageMetadata from "../../PackageMetadata";
import { EOL } from "os";
import {
  ApexSortedByType,
  FileDescriptor,
} from "../../apex/parser/ApexTypeFetcher";
import SFPStatsSender from "../../stats/SFPStatsSender";
import PackageEmptyChecker from "../PackageEmptyChecker";
import SFPPackage from "../SFPPackage";
import { CreatePackage } from "./CreatePackage";
const Table = require("cli-table");

export default class CreateSourcePackageImpl extends CreatePackage {
  public constructor(
    projectDirectory: string,
    sfdx_package: string,
    packageArtifactMetadata: PackageMetadata,
    breakBuildIfEmpty: boolean = true,
    logger?: Logger,
    pathToReplacementForceIgnore?: string
  ) {
    super(
      projectDirectory,
      sfdx_package,
      packageArtifactMetadata,
      breakBuildIfEmpty,
      logger,
      pathToReplacementForceIgnore
    );
  }

  getTypeOfPackage() {
    return "source";
  }

  printAdditionalPackageSpecificHeaders() {}

  isEmptyPackage(packageDirectory: string) {
    return PackageEmptyChecker.isEmptyFolder(
      this.projectDirectory,
      packageDirectory
    );
  }

  preCreatePackage(packageDirectory: string, packageDescriptor: any) {}

  public async createPackage(packageDirectory: string, packageDescriptor: any) {
    let sfppackage = await SFPPackage.buildPackageFromProjectConfig(
      this.logger,
      this.projectDirectory,
      this.sfdx_package,
      null,
      this.pathToReplacementForceIgnore
    );

    this.packageArtifactMetadata.payload = sfppackage.payload;
    this.packageArtifactMetadata.metadataCount = sfppackage.metadataCount;
    this.packageArtifactMetadata.isApexFound = sfppackage.isApexInPackage;
    this.packageArtifactMetadata.isProfilesFound =
      sfppackage.isProfilesInPackage;
    this.packageArtifactMetadata.assignPermSetsPreDeployment =
      sfppackage.assignPermSetsPreDeployment;
    this.packageArtifactMetadata.assignPermSetsPostDeployment =
      sfppackage.assignPermSetsPostDeployment;
    this.packageArtifactMetadata.reconcileProfiles =
      sfppackage.reconcileProfiles;
    this.packageArtifactMetadata.isPermissionSetGroupFound =
      sfppackage.isPermissionSetGroupInPackage;

    if (sfppackage.destructiveChanges) {
      this.packageArtifactMetadata.destructiveChanges =
        sfppackage.destructiveChanges;
    }

    this.handleApexTestClasses(sfppackage);

    SFPStatsSender.logGauge(
      "package.metadatacount",
      this.packageArtifactMetadata.metadataCount,
      {
        package: this.packageArtifactMetadata.package_name,
        type: this.packageArtifactMetadata.package_type,
      }
    );
  }

  postCreatePackage(packageDirectory: string, packageDescriptor: any) {}

  private handleApexTestClasses(mdapiPackage: SFPPackage) {
    let classTypes: ApexSortedByType = mdapiPackage.apexClassesSortedByTypes;

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
            this.logger
          );
          SFPLogger.log(
            "Unable to parse these classes to correctly identify test classes, Its not your issue, its ours! Please raise a issue in our repo!",
            LoggerLevel.INFO,
            this.logger
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

  private printHintForOptimizedDeployment() {
    SFPLogger.log(
      `---------------- OPTION FOR DEPLOYMENT OPTIMIZATION AVAILABLE-----------------------------------`,
      null,
      this.logger
    );
    SFPLogger.log(
      `Following apex test classes were identified and can  be used for deploying this package,${EOL}` +
        `in an optimal manner, provided each individual class meets the test coverage requirement of 75% and above${EOL}` +
        `Ensure each apex class/trigger is validated for coverage in the validation stage`,
      null,
      this.logger
    );
    SFPLogger.log(
      `-----------------------------------------------------------------------------------------------`,
      LoggerLevel.INFO,
      this.logger
    );
  }

  private printSlowDeploymentWarning() {
    SFPLogger.log(
      `-------WARNING! YOU MIGHT NOT BE ABLE TO DEPLOY OR WILL HAVE A SLOW DEPLOYMENT---------------`,
      LoggerLevel.INFO,
      this.logger
    );
    SFPLogger.log(
      `This package has apex classes/triggers, however apex test classes were not found, You would not be able to deploy${EOL}` +
        `to production org optimally if each class do not have coverage of 75% and above,We will attempt deploying${EOL}` +
        `this package by triggering all local tests in the org which could be realy costly in terms of deployment time!${EOL}`,
      null,
      this.logger
    );
    SFPLogger.log(
      `---------------------------------------------------------------------------------------------`,
      LoggerLevel.INFO,
      this.logger
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
      this.logger
    );
    SFPLogger.log(table.toString(), LoggerLevel.INFO, this.logger);
  }
}
