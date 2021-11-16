import child_process = require("child_process");
import PackageMetadata from "../../PackageMetadata";
import ProjectConfig from "../../project/ProjectConfig";
import SFPLogger, { LoggerLevel, Logger } from "../../logger/SFPLogger";
import * as fs from "fs-extra";
import { delay } from "../../utils/Delay";
import PackageVersionListImpl from "../../sfdxwrappers/PackageVersionListImpl";
import SFPPackage from "../../package/SFPPackage";
import { CreatePackage } from "./CreatePackage";
import CreateUnlockedPackageVersionImpl from "../../sfdxwrappers/CreateUnlockedPackageVersionImpl";
import PackageEmptyChecker from "../PackageEmptyChecker";
import PackageVersionCoverage from "../coverage/PackageVersionCoverage";
import { AuthInfo, Connection } from "@salesforce/core";
import { convertAliasToUsername } from "../../utils/AliasList";
import SFPStatsSender from "../../stats/SFPStatsSender";
const path = require("path");

export default class CreateUnlockedPackageImpl extends CreatePackage {
  private static packageTypeInfos: any[];
  private isOrgDependentPackage: boolean = false;
  private connection: Connection;
  workingDirectory: string;

  public constructor(
    sfdx_package: string,
    private version_number: string,
    configFilePath: string,
    private installationkeybypass: boolean,
    private installationkey: string,
    protected projectDirectory: string,
    private devHub: string,
    private waitTime: string,
    private isCoverageEnabled: boolean,
    private isSkipValidation: boolean,
    packageArtifactMetadata: PackageMetadata,
    pathToReplacementForceIgnore?: string,
    logger?: Logger
  ) {
    super(
      projectDirectory,
      sfdx_package,
      packageArtifactMetadata,
      true,
      logger,
      pathToReplacementForceIgnore,
      configFilePath
    );
  }

  getTypeOfPackage() {
    return "unlocked";
  }

  async preCreatePackage(packageDirectory: string, packageDescriptor: any) {
    this.connection = await Connection.create({
      authInfo: await AuthInfo.create({
        username: convertAliasToUsername(this.devHub),
      }),
    });

    let projectManifest = ProjectConfig.getSFDXPackageManifest(
      this.projectDirectory
    );

    let sfppackage: SFPPackage = await SFPPackage.buildPackageFromProjectConfig(
      this.logger,
      this.projectDirectory,
      this.sfdx_package,
      this.configFilePath,
      this.pathToReplacementForceIgnore
    );

    //Get the revised package Descriptor
    packageDescriptor = sfppackage.packageDescriptor;
    let packageId = ProjectConfig.getPackageId(
      projectManifest,
      this.sfdx_package
    );

    // Get working directory
    this.workingDirectory = sfppackage.workingDirectory;

    //Get the one in working directory
    this.configFilePath = path.join("config", "project-scratch-def.json");

    //Get Type of Package
    SFPLogger.log(
      "Fetching Package Type Info from DevHub",
      LoggerLevel.INFO,
      this.logger
    );
    let packageTypeInfos = await this.getPackageTypeInfos();
    let packageTypeInfo = packageTypeInfos.find((pkg) => pkg.Id == packageId);

    if (packageTypeInfo == null) {
      SFPLogger.log(
        "Unable to find a package info for this particular package, Are you sure you created this package?",
        LoggerLevel.WARN,
        this.logger
      );
      throw new Error("Unable to fetch Package Info");
    }

    if (packageTypeInfo.IsOrgDependent == "Yes")
      this.isOrgDependentPackage = true;

    SFPLogger.log(
      `Package  ${packageTypeInfo.Name}`,
      LoggerLevel.INFO,
      this.logger
    );
    SFPLogger.log(
      `IsOrgDependent ${packageTypeInfo.IsOrgDependent}`,
      LoggerLevel.INFO,
      this.logger
    );
    SFPLogger.log(
      `Package Id  ${packageTypeInfo.Id}`,
      LoggerLevel.INFO,
      this.logger
    );
    SFPLogger.log("-------------------------", LoggerLevel.INFO, this.logger);

    //cleanup sfpowerscripts constructs in working directory
    this.deleteSFPowerscriptsAdditionsToManifest(this.workingDirectory);

    //Resolve the package dependencies
    if (this.isOrgDependentPackage) {
      // Store original dependencies to artifact
      this.packageArtifactMetadata.dependencies =
        packageDescriptor["dependencies"];
    } else if (!this.isOrgDependentPackage && !this.isSkipValidation) {
      // With dependencies, so fetch it again
      this.resolvePackageDependencies(packageDescriptor, this.workingDirectory);
      //Redo the fetch of the descriptor as the above command would have redone the dependencies
      packageDescriptor = ProjectConfig.getSFDXPackageDescriptor(
        this.workingDirectory,
        this.sfdx_package
      );
      //Store the resolved dependencies
      this.packageArtifactMetadata.dependencies =
        packageDescriptor["dependencies"];
    } else {
      this.packageArtifactMetadata.dependencies =
        packageDescriptor["dependencies"];
    }

    this.packageArtifactMetadata.payload = sfppackage.payload;
    this.packageArtifactMetadata.metadataCount = sfppackage.metadataCount;
    this.packageArtifactMetadata.assignPermSetsPreDeployment =
      sfppackage.assignPermSetsPreDeployment;
    this.packageArtifactMetadata.assignPermSetsPostDeployment =
      sfppackage.assignPermSetsPostDeployment;
    this.packageArtifactMetadata.isApexFound = sfppackage.isApexInPackage;
    this.packageArtifactMetadata.isProfilesFound =
      sfppackage.isProfilesInPackage;
    this.packageArtifactMetadata.isPermissionSetGroupFound =
      sfppackage.isPermissionSetGroupInPackage;
  }

  async createPackage(packageDirectory: string, packageDescriptor: any) {
    let createUnlockedPackageImpl: CreateUnlockedPackageVersionImpl = new CreateUnlockedPackageVersionImpl(
      this.devHub,
      this.workingDirectory, //Use working directory for unlocked package
      this.sfdx_package,
      this.waitTime,
      this.configFilePath,
      this.logger,
      LoggerLevel.INFO,
      this.version_number,
      this.installationkeybypass,
      this.installationkey,
      this.packageArtifactMetadata.tag,
      this.isSkipValidation,
      this.isOrgDependentPackage,
      this.isCoverageEnabled
    );

    let result = await createUnlockedPackageImpl.exec(true);

    SFPLogger.log(
      `Package Result:${JSON.stringify(result)}`,
      LoggerLevel.TRACE,
      this.logger
    );
    this.packageArtifactMetadata.package_version_id =
      result.SubscriberPackageVersionId;

    //Get the full details on the package
    await this.getPackageInfo(this.packageArtifactMetadata.package_version_id);

    //Break if coverage is low
    if (this.isCoverageEnabled && !this.isOrgDependentPackage) {
      if (!this.packageArtifactMetadata.has_passed_coverage_check)
        throw new Error(
          "This package has not meet the minimum coverage requirement of 75%"
        );
    }
  }

  postCreatePackage(packageDirectory: string, packageDescriptor: any) {
    if (this.packageArtifactMetadata.isDependencyValidated) {
      SFPStatsSender.logGauge(
        "package.testcoverage",
        this.packageArtifactMetadata.test_coverage,
        {
          package: this.packageArtifactMetadata.package_name,
          from: "createpackage",
        }
      );
    }
  }

  isEmptyPackage(packageDirectory: string) {
    return PackageEmptyChecker.isEmptyFolder(
      this.projectDirectory,
      packageDirectory
    );
  }

  printAdditionalPackageSpecificHeaders() {}

  private deleteSFPowerscriptsAdditionsToManifest(workingDirectory: string) {
    let projectManifestFromWorkingDirectory = ProjectConfig.getSFDXPackageManifest(
      workingDirectory
    );
    let packageDescriptorInWorkingDirectory = ProjectConfig.getPackageDescriptorFromConfig(
      this.sfdx_package,
      projectManifestFromWorkingDirectory
    );

    //Cleanup sfpowerscripts constructs
    if (this.isOrgDependentPackage)
      delete packageDescriptorInWorkingDirectory["dependencies"];

    delete packageDescriptorInWorkingDirectory["type"];
    delete packageDescriptorInWorkingDirectory["assignPermSetsPreDeployment"];
    delete packageDescriptorInWorkingDirectory["assignPermSetsPostDeployment"];
    delete packageDescriptorInWorkingDirectory["skipDeployOnOrgs"];
    delete packageDescriptorInWorkingDirectory["skipTesting"];
    delete packageDescriptorInWorkingDirectory["skipCoverageValidation"];
    delete packageDescriptorInWorkingDirectory["ignoreOnStages"];
    delete packageDescriptorInWorkingDirectory["ignoreDeploymentErrors"];
    delete packageDescriptorInWorkingDirectory["preDeploymentScript"];
    delete packageDescriptorInWorkingDirectory["postDeploymentScript"];
    delete packageDescriptorInWorkingDirectory["aliasfy"];
    delete packageDescriptorInWorkingDirectory["checkpointForPrepare"];

    fs.writeJsonSync(
      path.join(workingDirectory, "sfdx-project.json"),
      projectManifestFromWorkingDirectory
    );
  }

  private async getPackageInfo(versionId) {
    let packageVersionCoverage: PackageVersionCoverage = new PackageVersionCoverage(
      this.connection,
      this.logger
    );
    let count = 0;
    while (count < 10) {
      count++;
      try {
        SFPLogger.log(
          "Fetching Version Number and Coverage details",
          LoggerLevel.INFO,
          this.logger
        );

        let pkgInfoResult = await packageVersionCoverage.getCoverage(versionId);

        this.packageArtifactMetadata.isDependencyValidated = !this
          .isSkipValidation;
        this.packageArtifactMetadata.package_version_number =
          pkgInfoResult.packageVersionNumber;
        this.packageArtifactMetadata.test_coverage = pkgInfoResult.coverage;
        this.packageArtifactMetadata.has_passed_coverage_check =
          pkgInfoResult.HasPassedCodeCoverageCheck;
        break;
      } catch (error) {
        SFPLogger.log(
          `Unable to fetch package version info due to ${error.message}`,
          LoggerLevel.INFO,
          this.logger
        );
        SFPLogger.log("Retrying...", LoggerLevel.INFO, this.logger);
        await delay(2000);
        continue;
      }
    }
  }

  private async getPackageTypeInfos() {
    if (CreateUnlockedPackageImpl.packageTypeInfos == null) {
      CreateUnlockedPackageImpl.packageTypeInfos = await new PackageVersionListImpl(
        this.devHub
      ).exec();
    }
    return CreateUnlockedPackageImpl.packageTypeInfos;
  }

  private resolvePackageDependencies(
    packageDescriptor: any,
    workingDirectory: string
  ) {
    SFPLogger.log("Resolving project dependencies", LoggerLevel.INFO, this.logger);

    let resolveResult = child_process.execSync(
      `sfdx sfpowerkit:package:dependencies:list -p ${packageDescriptor["path"]} -v ${this.devHub} -w --usedependencyvalidatedpackages`,
      { cwd: workingDirectory, encoding: "utf8" }
    );

    SFPLogger.log(
      `Resolved Depenendecies: ${resolveResult}`,
      LoggerLevel.INFO,
      this.logger
    );
  }
}
