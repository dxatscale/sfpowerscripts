import SFPLogger from "../utils/SFPLogger";
import PackageMetadata from "../PackageMetadata";
import SourcePackageGenerator from "../generators/SourcePackageGenerator";
import ManifestHelpers from "../manifest/ManifestHelpers";
import MDAPIPackageGenerator from "../generators/MDAPIPackageGenerator";
import { isNullOrUndefined } from "util";
import { EOL } from "os";

import * as fs from "fs-extra";
import path = require("path");
import ApexTypeFetcher, { FileDescriptor } from "../parser/ApexTypeFetcher";
import SFPStatsSender from "../utils/SFPStatsSender";
import { PackageXMLManifestHelpers } from "../manifest/PackageXMLManifestHelpers";
const Table = require("cli-table");

export default class CreateSourcePackageImpl {
  private packageLogger;

  public constructor(
    private projectDirectory: string,
    private sfdx_package: string,
    private destructiveManifestFilePath: string,
    private packageArtifactMetadata: PackageMetadata,
    private forceignorePath?: string
  ) {
    fs.outputFileSync(
      `.sfpowerscripts/logs/${sfdx_package}`,
      `sfpowerscripts--log${EOL}`
    );
    this.packageLogger = `.sfpowerscripts/logs/${sfdx_package}`;
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
      "destructiveManifestFilePath",
      this.destructiveManifestFilePath,
      this.packageLogger
    );
    SFPLogger.log(
      "packageArtifactMetadata",
      this.packageArtifactMetadata,
      this.packageLogger
    );

    let startTime = Date.now();

    //Get Package Descriptor
    let packageDescriptor, packageDirectory: string;
    if (!isNullOrUndefined(this.sfdx_package)) {
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

      this.packageArtifactMetadata.permissionSetsToAssign = packageDescriptor
          .permissionSetsToAssign?.split(",");
    }

    //Generate Destructive Manifest
    let destructiveChanges: DestructiveChanges = this.getDestructiveChanges(
      packageDescriptor,
      this.destructiveManifestFilePath
    );
    if (!isNullOrUndefined(destructiveChanges)) {
      this.packageArtifactMetadata.isDestructiveChangesFound =
        destructiveChanges.isDestructiveChangesFound;
      this.packageArtifactMetadata.destructiveChanges =
        destructiveChanges.destructiveChanges;
    }

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

        this.packageArtifactMetadata.payload = mdapiPackage.manifest;
        this.packageArtifactMetadata.metadataCount = mdapiPackage.metadataCount;
        this.packageArtifactMetadata.isApexFound = PackageXMLManifestHelpers.checkApexInPayload(
          mdapiPackage.manifest
        );
        this.packageArtifactMetadata.isProfilesFound = PackageXMLManifestHelpers.checkProfilesinPayload(
          mdapiPackage.manifest
        );

        this.handleApexTestClasses(mdapiPackage);
      } else {
        this.printEmptyArtifactWarning();
      }
    } else {
      SFPLogger.log(
        "Proceeding with all packages.. as a particular package was not provided",
        null,
        this.packageLogger
      );
    }

    //Get Artifact Detailes
    let sourcePackageArtifactDir = SourcePackageGenerator.generateSourcePackageArtifact(
      this.projectDirectory,
      this.sfdx_package,
      packageDirectory,
      isNullOrUndefined(destructiveChanges)
        ? undefined
        : destructiveChanges.destructiveChangesPath
    );

    // Replace root forceignore with ignore file from relevant stage e.g. build, quickbuild
    if (this.forceignorePath) {
      if (fs.existsSync(path.join(sourcePackageArtifactDir, this.forceignorePath)))
        fs.copySync(
          path.join(sourcePackageArtifactDir, this.forceignorePath),
          path.join(sourcePackageArtifactDir, ".forceignore")
        );
      else {
        SFPLogger.log(`${path.join(sourcePackageArtifactDir, this.forceignorePath)} does not exist`, null, this.packageLogger);
        SFPLogger.log("Package creation will continue using the unchanged forceignore in the root directory", null, this.packageLogger);
      }
    }

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

  private handleApexTestClasses(mdapiPackage: any) {
    let apexTypeFetcher: ApexTypeFetcher = new ApexTypeFetcher();
    let classTypes;
    try {
      classTypes = apexTypeFetcher.getApexTypeOfClsFiles(
        path.join(mdapiPackage.mdapiDir, `classes`)
      );
    } catch (error) {
      return;
    }

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
            null,
            this.packageLogger
          );
          SFPLogger.log(
            "Unable to parse these classes to correctly identify test classes, Its not your issue, its ours! Please raise a issue in our repo!",
            null,
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
      null,
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
      null,
      this.packageLogger
    );
  }

  private printSlowDeploymentWarning() {
    SFPLogger.log(
      `-------WARNING! YOU MIGHT NOT BE ABLE TO DEPLOY OR WILL HAVE A SLOW DEPLOYMENT---------------`,
      null,
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
      null,
      this.packageLogger
    );
  }

  private getDestructiveChanges(
    packageDescriptor: any,
    destructiveManifestFilePath: string
  ): DestructiveChanges {
    let destructiveChanges: any;
    let isDestructiveChangesFound: boolean = false;
    let destructiveChangesPath: string;

    if (packageDescriptor === null || packageDescriptor === undefined) {
      return undefined;
    }

    //Precedence to Value Passed in Flags
    if (!isNullOrUndefined(destructiveManifestFilePath)) {
      destructiveChangesPath = destructiveManifestFilePath;
    } else {
      if (packageDescriptor["destructiveChangePath"]) {
        destructiveChangesPath = packageDescriptor["destructiveChangePath"];
      }
    }

    try {
      if (!isNullOrUndefined(destructiveChangesPath)) {
        destructiveChanges = JSON.parse(
          fs.readFileSync(destructiveChangesPath, "utf8")
        );
        isDestructiveChangesFound = true;
      }
    } catch (error) {
      SFPLogger.log(
        "Unable to process destructive Manifest specified in the path or in the project manifest",
        null,
        this.packageLogger
      );
      destructiveChangesPath = null;
    }

    return {
      isDestructiveChangesFound: isDestructiveChangesFound,
      destructiveChangesPath: destructiveChangesPath,
      destructiveChanges: destructiveChanges,
    };
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
        fetchedClass.error ? fetchedClass.error : "N/A",
      ];
      table.push(item);
    }
    SFPLogger.log(
      "Following apex test classes were identified",
      null,
      this.packageLogger
    );
    SFPLogger.log(table.toString(), null, this.packageLogger);
  }
}
type DestructiveChanges = {
  isDestructiveChangesFound: boolean;
  destructiveChangesPath: string;
  destructiveChanges: any;
};
