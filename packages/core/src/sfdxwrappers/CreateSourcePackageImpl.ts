import PackageMetadata from "../PackageMetadata";
import SourcePackageGenerator from "../generators/SourcePackageGenerator";
import ManifestHelpers from "../manifest/ManifestHelpers";
import MDAPIPackageGenerator from "../generators/MDAPIPackageGenerator";
import { isNullOrUndefined } from "util";
import { EOL } from "os";
import TestClassFetcher from "../parser/TestClassFetcher";
const fs = require("fs-extra");
import path = require("path");
const Table = require("cli-table");

export default class CreateSourcePackageImpl {
  public constructor(
    private projectDirectory: string,
    private sfdx_package: string,
    private destructiveManifestFilePath: string,
    private packageArtifactMetadata: PackageMetadata
  ) {}

  public async exec(): Promise<PackageMetadata> {
    //Only set package type to source if its not provided, delta will be setting it up
    if (
      this.packageArtifactMetadata.package_type === null ||
      this.packageArtifactMetadata.package_type === undefined
    )
      this.packageArtifactMetadata.package_type = "source";

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
        this.packageArtifactMetadata.isApexFound = ManifestHelpers.checkApexInPayload(
          mdapiPackage.manifest
        );
        this.packageArtifactMetadata.isProfilesFound = ManifestHelpers.checkProfilesinPayload(
          mdapiPackage.manifest
        );

        let testClassFetcher: TestClassFetcher = new TestClassFetcher();
        let testClasses: {file:string,name:string}[] = testClassFetcher.getTestClassNames(path.join(mdapiPackage.mdapiDir, `classes`));

        if (!this.packageArtifactMetadata.isTriggerAllTests) {
          if (
            this.packageArtifactMetadata.isApexFound &&
            testClasses.length==0
          ) {
            console.log(`-------WARNING! YOU MIGHT NOT BE ABLE TO DEPLOY OR WILL HAVE A SLOW DEPLOYMENT---------------`);
            console.log(
              `This package has apex classes/triggers, however apex test classes were not found, You would not be able to deploy${EOL}` +
              `to production org optimally if each class do not have coverage of 75% and above,We will attempt deploying${EOL}` +
              `this package by triggering all local tests in the org which could be realy costly in terms of deployment time!${EOL}`
            );
            console.log(`---------------------------------------------------------------------------------------------`);
            this.packageArtifactMetadata.isTriggerAllTests = true;
          } else if (
            this.packageArtifactMetadata.isApexFound &&
            testClasses.length>0
          ) {
            console.log(`---------------- OPTION FOR DEPLOYMENT OPTIMIZATION AVAILABLE-----------------------------------`);
            console.log(`Following apex test classes were identified and can  be used for deploying this package,${EOL}`+
                        `in an optimal manner, provided each individual class meets the test coverage requirement of 75% and above${EOL}`+
                        `Ensure each apex class/trigger is validated for coverage in the validation stage`);
            console.log(`-----------------------------------------------------------------------------------------------`);
            this.printTestClassesIdentified(testClasses);
            this.packageArtifactMetadata.apexTestClassses=[];
            testClasses.forEach(element => {
              this.packageArtifactMetadata.apexTestClassses.push(element.name);
            });
          }
        }



        
      } else {
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
    } else {
      console.log(
        "Proceeding with all packages.. as a particular package was not provided"
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
      console.log(
        "Unable to process destructive Manifest specified in the path or in the project manifest"
      );
      destructiveChangesPath = null;
    }

    return {
      isDestructiveChangesFound: isDestructiveChangesFound,
      destructiveChangesPath: destructiveChangesPath,
      destructiveChanges: destructiveChanges,
    };
  }

  private  printTestClassesIdentified(testClasses:{file:string,name:string}[]) {

    //If Manifest is null, just return
    if(testClasses===null || testClasses===undefined)
        return;
     
    let table = new Table({
      head: ["Test Class", "Path"],
    });

    for (let testclass of testClasses) {
      let item = [testclass.name, testclass.file];
      table.push(item);
    }
    console.log("Following apex test classes were identified");
    console.log(table.toString());
  }
}
type DestructiveChanges = {
  isDestructiveChangesFound: boolean;
  destructiveChangesPath: string;
  destructiveChanges: any;
};
