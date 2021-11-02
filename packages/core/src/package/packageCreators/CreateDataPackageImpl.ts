import PackageMetadata from "../../PackageMetadata";
import SFPLogger, { LoggerLevel, Logger } from "../../logger/SFPLogger";
import path from "path";
import FileSystem from "../../utils/FileSystem";
import { CreatePackage } from "./CreatePackage";

const SFDMU_CONFIG = "export.json";
const VLOCITY_CONFIG = "VlocityComponents.yaml";

export default class CreateDataPackageImpl extends CreatePackage {
  public constructor(
    projectDirectory: string,
    sfdx_package: string,
    packageArtifactMetadata: PackageMetadata,
    breakBuildIfEmpty: boolean = true,
    logger?: Logger
  ) {
    super(
      projectDirectory,
      sfdx_package,
      packageArtifactMetadata,
      breakBuildIfEmpty,
      logger
    );
  }

  getTypeOfPackage() {
    return "data";
  }

  isEmptyPackage(packageDirectory: string): boolean {
    let files: string[] = FileSystem.readdirRecursive(packageDirectory);

    let hasExportJson = files.find(
      (file) => path.basename(file) === "export.json"
    );

    let hasCsvFile = files.find((file) => path.extname(file) === ".csv");

    if (!hasExportJson || !hasCsvFile) return true;
    else return false;
  }

  preCreatePackage(packageDirectory: string, packageDescriptor: any) {
    this.validateDataPackage(packageDirectory);
  }

  createPackage(packageDirectory: string, packageDescriptor: any) {

    //Do Nothing, as no external calls or processing is required
  }

  postCreatePackage(packageDirectory: string, packageDescriptor: any) {
  }
  
  printAdditionalPackageSpecificHeaders() {}

  // Validate type of data package and existence of the correct configuration files
  private validateDataPackage(packageDirectory: string) {
    const files = FileSystem.readdirRecursive(packageDirectory);
    let isSfdmu: boolean;
    let isVlocity: boolean;

    for (const file of files) {
      if (path.basename(file) === SFDMU_CONFIG) isSfdmu = true;
      if (path.basename(file) === VLOCITY_CONFIG) isVlocity = true;
    }

    if (isSfdmu && isVlocity) {
      throw new Error(
        `Data package '${this.sfdx_package}' contains both SFDMU & Vlocity configuration`
      );
    } else if (isSfdmu) {
      SFPLogger.log(
        `Found export.json in ${packageDirectory}.. Utilizing it as data package and will be deployed using sfdmu`,
        LoggerLevel.INFO,
        this.logger
      );
    } else if (isVlocity) {
      SFPLogger.log(
        `Found VlocityComponents.yaml in ${packageDirectory}.. Utilizing it as data package and will be deployed using vbt`,
        LoggerLevel.INFO,
        this.logger
      );
    } else {
      throw new Error(
        `Could not find export.json or VlocityComponents.yaml in ${packageDirectory}. sfpowerscripts only support vlocity or sfdmu based data packages`
      );
    }
  }
}
