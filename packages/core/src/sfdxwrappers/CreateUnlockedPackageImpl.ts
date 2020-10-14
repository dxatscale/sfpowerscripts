import child_process = require("child_process");
import { isNullOrUndefined } from "util";
import { onExit } from "../utils/OnExit";
import PackageMetadata from "../PackageMetadata";
import SourcePackageGenerator from "../generators/SourcePackageGenerator";
import ManifestHelpers from "../manifest/ManifestHelpers";
import MDAPIPackageGenerator from "../generators/MDAPIPackageGenerator";
import SFPLogger from "../utils/SFPLogger";
import { Logger,configure } from "log4js";

export default class CreateUnlockedPackageImpl {

   private packageLogger:Logger;
 

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
    private packageArtifactMetadata: PackageMetadata
  ) {
    let configuration = {
      appenders: {
        fileLogger: {
          type: 'file',
          filename: `.sfpowerscripts/logs/${sfdx_package}`,
          layout: {
            type: 'pattern',
            pattern: '%r %m%n'},
          flags:'w'
        }
      },
      categories: {
        default: { appenders: ['fileLogger'], level: 'all' }
      }
    };
    this.packageLogger= configure(configuration).getLogger();
  }

  public async exec(): Promise<PackageMetadata> {
    this.packageArtifactMetadata.package_type = "unlocked";
    let startTime = Date.now();

    let packageDescriptor = ManifestHelpers.getSFDXPackageDescriptor(
      this.project_directory,
      this.sfdx_package
    );

    let packageDirectory: string = packageDescriptor["path"];
    SFPLogger.log("Package Directory", packageDirectory,this.packageLogger);

   //Resolve the package dependencies
    this.resolvePackageDependencies(packageDescriptor);

    //Redo the fetch of the descriptor as the above command would have redone the dependencies

    packageDescriptor = ManifestHelpers.getSFDXPackageDescriptor(
      this.project_directory,
      this.sfdx_package
    );

    //Convert to MDAPI to get PayLoad
    let mdapiPackage = await MDAPIPackageGenerator.getMDAPIPackageFromSourceDirectory(
      this.project_directory,
      packageDirectory
    );
    this.packageArtifactMetadata.payload = mdapiPackage.manifest;

   
    let command = this.buildExecCommand();
    SFPLogger.log("Package Creation Command", command,this.packageLogger);
    let child = child_process.exec(
      command,
      { cwd: this.project_directory, encoding: "utf8" }
    );

    let output = "";
    child.stdout.on("data", (data) => {
      SFPLogger.log(data.toString(),null,this.packageLogger);
      output += data.toString();
    });

    await onExit(child);
    this.packageArtifactMetadata.package_version_id = JSON.parse(
      output
    ).result.SubscriberPackageVersionId;

    //Get the full details on the package
    SFPLogger.log("Fetching Version Number and Coverage details",null,this.packageLogger);
    let pkgInfoResultAsJSON = child_process.execSync(
      this.buildInfoCommand(this.packageArtifactMetadata.package_version_id),
      {
        cwd: this.project_directory,
        encoding: "utf8",
      }
    );

     SFPLogger.log("Package Info Fetched", pkgInfoResultAsJSON,this.packageLogger);

    let pkgInfoResult = JSON.parse(pkgInfoResultAsJSON);
    this.packageArtifactMetadata.isDependencyValidated = this.isSkipValidation;
    this.packageArtifactMetadata.package_version_number =
      pkgInfoResult.result[0].packageVersionNumber;
    this.packageArtifactMetadata.test_coverage =
      pkgInfoResult.result[0].coverage;
    this.packageArtifactMetadata.has_passed_coverage_check =
      pkgInfoResult.result[0].HasPassedCodeCoverageCheck;

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

    this.packageArtifactMetadata.dependencies =
      packageDescriptor["dependencies"];
    this.packageArtifactMetadata.sourceDir = mdapiPackageArtifactDir;

    //Add Timestamps
    let endTime = Date.now();
    let elapsedTime = endTime - startTime;
    this.packageArtifactMetadata.creation_details = {
      creation_time: elapsedTime,
      timestamp: Date.now(),
    };


    return this.packageArtifactMetadata;
  }

  private resolvePackageDependencies(packageDescriptor: any) {
   SFPLogger.log("Resolving project dependencies",null,this.packageLogger);
    let resolveResult;
    if (this.isSkipValidation) {
      let resolveResult;
      resolveResult = child_process.execSync(
        `sfdx sfpowerkit:package:dependencies:list -p ${packageDescriptor["path"]} -v ${this.devhub_alias} -w`,
        { cwd: this.project_directory, encoding: "utf8" }
      );
    }
    else {
      resolveResult = child_process.execSync(
        `sfdx sfpowerkit:package:dependencies:list -p ${packageDescriptor["path"]} -v ${this.devhub_alias} -w --usedependencyvalidatedpackages`,
        { cwd: this.project_directory, encoding: "utf8" }
      );
    }
    SFPLogger.log(resolveResult,null,this.packageLogger);
  }

  private buildExecCommand(): string {
    let command = `npx sfdx force:package:version:create -p ${this.sfdx_package}  -w ${this.wait_time} --definitionfile ${this.config_file_path} --json`;

    if (!isNullOrUndefined(this.version_number))
      command += `  --versionnumber ${this.version_number}`;

    if (this.installationkeybypass) command += ` -x`;
    else command += ` -k ${this.installationkey}`;

    if (!isNullOrUndefined(this.packageArtifactMetadata.tag))
      command += ` -t ${this.packageArtifactMetadata.tag}`;

    if (this.isCoverageEnabled) command += ` -c`;

    if (this.isSkipValidation) command += ` --skipvalidation`;

    command += ` -v ${this.devhub_alias}`;

    return command;
  }

  private buildInfoCommand(subscriberPackageVersion: string): string {
    let command = `npx sfdx sfpowerkit:package:version:codecoverage -i ${subscriberPackageVersion}  --json`;

    command += ` -v ${this.devhub_alias}`;

    return command;
  }
}
