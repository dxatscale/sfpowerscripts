import child_process = require("child_process");
import { isNullOrUndefined } from "util";
import { onExit } from "../utils/OnExit";
import PackageMetadata from "../PackageMetadata";
import SourcePackageGenerator from "../generators/SourcePackageGenerator";
import ManifestHelpers from "../manifest/ManifestHelpers";
import MDAPIPackageGenerator from "../generators/MDAPIPackageGenerator";
import SFPLogger from "../utils/SFPLogger";
import * as fs from "fs-extra";
import { EOL } from "os";
import { delay } from "../utils/Delay";
import PackageVersionListImpl from "./PackageVersionListImpl";
import SFPStatsSender from "../utils/SFPStatsSender";
const path = require("path");

export default class CreateUnlockedPackageImpl {
  private packageLogger;
  private static packageTypeInfos: any[];
  private isOrgDependentPackage: boolean = false;

  public constructor(
    private sfdx_package: string,
    private version_number: string,
    private config_file_path: string,
    private installationkeybypass: boolean,
    private installationkey: string,
    private project_directory: string,
    private devhub_alias: string,
    private wait_time: string,
    private isCoverageEnabled: boolean,
    private isSkipValidation: boolean,
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
    this.packageArtifactMetadata.package_type = "unlocked";

    let startTime = Date.now();

    let projectManifest = ManifestHelpers.getSFDXPackageManifest(
      this.project_directory
    );


    //Create a working directory
    let workingDirectory = SourcePackageGenerator.generateSourcePackageArtifact(
      this.project_directory,
      this.sfdx_package,
      ManifestHelpers.getPackageDescriptorFromConfig(
        this.sfdx_package,
        projectManifest
      )["path"],
      null,
      this.config_file_path
    );

    // Replace root forceignore with ignore file from relevant stage e.g. build, quickbuild
    if (this.forceignorePath) {
      if (fs.existsSync(path.join(workingDirectory, this.forceignorePath)))
        fs.copySync(
          path.join(workingDirectory, this.forceignorePath),
          path.join(workingDirectory, ".forceignore")
        );
      else {
        SFPLogger.log(`${path.join(workingDirectory, this.forceignorePath)} does not exist`, null, this.packageLogger);
        SFPLogger.log("Package creation will continue using the unchanged forceignore in the root directory", null, this.packageLogger);
      }
    }

    //Get the one in working directory
    this.config_file_path = path.join("config", "project-scratch-def.json");

    //Get the revised package Descriptor
    let packageDescriptor = ManifestHelpers.getSFDXPackageDescriptor(
      workingDirectory,
      this.sfdx_package
    );

    let packageId = ManifestHelpers.getPackageId(
      projectManifest,
      this.sfdx_package
    );

    let packageDirectory: string = packageDescriptor["path"];
    SFPLogger.log("Package Directory", packageDirectory, this.packageLogger);

    //Get Type of Package
    SFPLogger.log(
      "Fetching Package Type Info from DevHub",
      null,
      this.packageLogger
    );
    await this.getPackageTypeInfos();
    let packageTypeInfo = CreateUnlockedPackageImpl.packageTypeInfos.find(
      (pkg) => pkg.Id == packageId
    );
    if (packageTypeInfo.IsOrgDependent == "Yes")
      this.isOrgDependentPackage = true;

    SFPLogger.log("-------------------------", null, this.packageLogger);
    SFPLogger.log("Package", packageTypeInfo.Name, this.packageLogger);
    SFPLogger.log(
      "IsOrgDependent",
      packageTypeInfo.IsOrgDependent,
      this.packageLogger
    );
    SFPLogger.log("Package Id", packageTypeInfo.Id, this.packageLogger);
    SFPLogger.log("-------------------------", null, this.packageLogger);


    //Fetch Post Deployment Steps
    this.fetchPostDeploymentSteps(packageDescriptor);

    //cleanup sfpowerscripts constructs in working directory
    this.deleteSFPowerscriptsAdditionsToManifest(workingDirectory);

    //Resolve the package dependencies
    if (this.isOrgDependentPackage) {
      // Store original dependencies to artifact
      this.packageArtifactMetadata.dependencies =
        packageDescriptor["dependencies"];
    } else if (!this.isOrgDependentPackage && !this.isSkipValidation) { // With dependencies, so fetch it again
      this.resolvePackageDependencies(packageDescriptor, workingDirectory);
      //Redo the fetch of the descriptor as the above command would have redone the dependencies
      packageDescriptor = ManifestHelpers.getSFDXPackageDescriptor(
        workingDirectory,
        this.sfdx_package
      );
      //Store the resolved dependencies
      this.packageArtifactMetadata.dependencies =
        packageDescriptor["dependencies"];
    } else {
      this.packageArtifactMetadata.dependencies =
        packageDescriptor["dependencies"];
    }

    //Convert to MDAPI to get PayLoad
    let mdapiPackage = await MDAPIPackageGenerator.getMDAPIPackageFromSourceDirectory(
      workingDirectory,
      packageDirectory
    );

    this.packageArtifactMetadata.payload = mdapiPackage.manifest;
    this.packageArtifactMetadata.metadataCount = mdapiPackage.metadataCount;

    let command = this.buildExecCommand();
    let output = "";
    SFPLogger.log("Package Creation Command", command, this.packageLogger);
    let child = child_process.exec(command, {
      cwd: workingDirectory,
      encoding: "utf8",
    });

    child.stderr.on("data", (data) => {
      SFPLogger.log(data.toString(), null, this.packageLogger);
    });

    child.stdout.on("data", (data) => {
      SFPLogger.log(data.toString(), null, this.packageLogger);
      output += data.toString();
    });

    await onExit(child);

    this.packageArtifactMetadata.package_version_id = JSON.parse(
      output
    ).result.SubscriberPackageVersionId;

    //Get the full details on the package
    await this.getPackageInfo();

    //Generate Source Artifact
    let mdapiPackageArtifactDir = SourcePackageGenerator.generateSourcePackageArtifact(
      this.project_directory,
      this.sfdx_package,
      ManifestHelpers.getSFDXPackageDescriptor(
        this.project_directory,
        this.sfdx_package
      )["path"],
      null
    );

    if (this.forceignorePath) {
      if (fs.existsSync(path.join(mdapiPackageArtifactDir, this.forceignorePath)))
        fs.copySync(
          path.join(mdapiPackageArtifactDir, this.forceignorePath),
          path.join(mdapiPackageArtifactDir, ".forceignore")
        );
    }

    this.packageArtifactMetadata.sourceDir = mdapiPackageArtifactDir;

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
        type: this.packageArtifactMetadata.package_type,
      }
    );

    SFPStatsSender.logElapsedTime(
      "package.elapsed.time",
      this.packageArtifactMetadata.creation_details.creation_time,
      {
        package: this.packageArtifactMetadata.package_name,
        type: this.packageArtifactMetadata.package_type,
        is_dependency_validated: String(
          this.packageArtifactMetadata.isDependencyValidated
        ),
      }
    );
    SFPStatsSender.logCount("package.created", {
      package: this.packageArtifactMetadata.package_name,
      type: this.packageArtifactMetadata.package_type,
      is_dependency_validated: String(
        this.packageArtifactMetadata.isDependencyValidated
      ),
    });

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

    return this.packageArtifactMetadata;
  }

  private fetchPostDeploymentSteps(packageDescriptor: any) {
    this.packageArtifactMetadata.postDeploymentSteps = packageDescriptor["postDeploymentSteps"]?.split(",");

    this.packageArtifactMetadata.permissionSetsToAssign = packageDescriptor
      .permissionSetsToAssign?.split(",");
  }

  private deleteSFPowerscriptsAdditionsToManifest(workingDirectory: string) {
    let projectManifestFromWorkingDirectory = ManifestHelpers.getSFDXPackageManifest(
      workingDirectory
    );
    let packageDescriptorInWorkingDirectory = ManifestHelpers.getPackageDescriptorFromConfig(
      this.sfdx_package,
      projectManifestFromWorkingDirectory
    );

    //Cleanup sfpowerscripts constructs
    if (this.isOrgDependentPackage)
      delete packageDescriptorInWorkingDirectory["dependencies"];

    delete packageDescriptorInWorkingDirectory["type"];
    delete packageDescriptorInWorkingDirectory["preDeploymentSteps"];
    delete packageDescriptorInWorkingDirectory["postDeploymentSteps"];
    delete packageDescriptorInWorkingDirectory["permissionSetsToAssign"];
    delete packageDescriptorInWorkingDirectory["skipDeployOnOrgs"];
    delete packageDescriptorInWorkingDirectory["skipTesting"];
    delete packageDescriptorInWorkingDirectory["skipCoverageValidation"];
    delete packageDescriptorInWorkingDirectory["ignoreOnStages"];
    delete packageDescriptorInWorkingDirectory["ignoreDeploymentErrors"];
    delete packageDescriptorInWorkingDirectory["preDeploymentScript"];
    delete packageDescriptorInWorkingDirectory["postDeploymentScript"];
    delete packageDescriptorInWorkingDirectory["aliasfy"];




    fs.writeJsonSync(
      path.join(workingDirectory, "sfdx-project.json"),
      projectManifestFromWorkingDirectory
    );
  }

  private async getPackageInfo() {
    while (true) {
      try {
        SFPLogger.log(
          "Fetching Version Number and Coverage details",
          null,
          this.packageLogger
        );
        let pkgInfoResultAsJSON = child_process.execSync(
          this.buildInfoCommand(
            this.packageArtifactMetadata.package_version_id
          ),
          {
            cwd: this.project_directory,
            encoding: "utf8",
          }
        );

        SFPLogger.log(
          "Package Info Fetched",
          pkgInfoResultAsJSON,
          this.packageLogger
        );

        let pkgInfoResult = JSON.parse(pkgInfoResultAsJSON);
        this.packageArtifactMetadata.isDependencyValidated = !this
          .isSkipValidation;
        this.packageArtifactMetadata.package_version_number =
          pkgInfoResult.result[0].packageVersionNumber;
        this.packageArtifactMetadata.test_coverage =
          pkgInfoResult.result[0].coverage;
        this.packageArtifactMetadata.has_passed_coverage_check =
          pkgInfoResult.result[0].HasPassedCodeCoverageCheck;
        break;
      } catch (error) {
        SFPLogger.log(
          "Unable to fetch package version info",
          null,
          this.packageLogger
        );
        console.log("Retrying...");
        await delay(2000);
        continue;
      }
    }
  }

  private async getPackageTypeInfos() {
    if (CreateUnlockedPackageImpl.packageTypeInfos == null) {
      CreateUnlockedPackageImpl.packageTypeInfos = await new PackageVersionListImpl(
        this.project_directory,
        this.devhub_alias
      ).exec();
    }
    return CreateUnlockedPackageImpl.packageTypeInfos;
  }

  private resolvePackageDependencies(
    packageDescriptor: any,
    workingDirectory: string
  ) {
    SFPLogger.log("Resolving project dependencies", null, this.packageLogger);

    let resolveResult = child_process.execSync(
      `sfdx sfpowerkit:package:dependencies:list -p ${packageDescriptor["path"]} -v ${this.devhub_alias} -w --usedependencyvalidatedpackages`,
      { cwd: workingDirectory, encoding: "utf8" }
    );

    SFPLogger.log("Resolved Depenendecies", resolveResult, this.packageLogger);
  }

  private buildExecCommand(): string {
    let command = `npx sfdx force:package:version:create -p ${this.sfdx_package}  -w ${this.wait_time} --definitionfile ${this.config_file_path} --json`;

    if (!isNullOrUndefined(this.version_number))
      command += `  --versionnumber ${this.version_number}`;

    if (this.installationkeybypass) command += ` -x`;
    else command += ` -k ${this.installationkey}`;

    if (!isNullOrUndefined(this.packageArtifactMetadata.tag))
      command += ` -t ${this.packageArtifactMetadata.tag}`;

    if (!isNullOrUndefined(this.packageArtifactMetadata.branch))
      command += ` --branch ${this.packageArtifactMetadata.branch}`;

    if (this.isCoverageEnabled && !this.isOrgDependentPackage) command += ` -c`;

    if (this.isSkipValidation && !this.isOrgDependentPackage)
      command += ` --skipvalidation`;

    command += ` -v ${this.devhub_alias}`;

    return command;
  }

  private buildInfoCommand(subscriberPackageVersion: string): string {
    let command = `npx sfdx sfpowerkit:package:version:codecoverage -i ${subscriberPackageVersion}  --json`;

    command += ` -v ${this.devhub_alias}`;

    return command;
  }
}
