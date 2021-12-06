import PackageMetadata from "../../PackageMetadata";
import fs = require("fs-extra");
import SFPLogger, { Logger, LoggerLevel } from "../../logger/SFPLogger";
import SFDMURunImpl from "../../sfdmuwrapper/SFDMURunImpl";
import VlocityPackDeployImpl from "../../vlocitywrapper/VlocityPackDeployImpl";
import { SFDXCommand } from "../../command/SFDXCommand";
const path = require("path");
import OrgDetailsFetcher from "../../org/OrgDetailsFetcher";
import { InstallPackage } from "./InstallPackage";

export default class InstallDataPackageImpl extends InstallPackage {
  public constructor(
    sfdxPackage: string,
    targetusername: string,
    sourceDirectory: string,
    packageMetadata: PackageMetadata,
    skipIfPackageInstalled: boolean,
    logger: Logger,
    private logLevel: LoggerLevel,
    isDryRun:boolean
  ) {
    super(
      sfdxPackage,
      targetusername,
      sourceDirectory,
      packageMetadata,
      skipIfPackageInstalled,
      logger,
      isDryRun
    );
  }

  public async install() {
    try {
      //Fetch the sfdxcommand executor for the type
      let dataPackageDeployer: SFDXCommand = await this.getSFDXCommand(
        this.sourceDirectory,
        this.packageDirectory
      );

      SFPLogger.log(`Executing installation command: ${dataPackageDeployer.getGeneratedSFDXCommandWithParams()}`)
      let result = await dataPackageDeployer.exec(false);

      SFPLogger.log(result, LoggerLevel.INFO, this.logger);
    } catch (error) {
      let csvIssuesReportFilepath: string = path.join(
        this.sourceDirectory,
        this.packageDirectory,
        `CSVIssuesReport.csv`
      );
      if (fs.existsSync(csvIssuesReportFilepath)) {
        SFPLogger.log(
          `\n---------------------WARNING: SFDMU detected CSV issues, verify the following files -------------------------------`,
          LoggerLevel.WARN,
          this.logger
        );
        SFPLogger.log(
          fs.readFileSync(csvIssuesReportFilepath, "utf8"),
          LoggerLevel.INFO,
          this.logger
        );
      }
      throw error;
    }
  }
  private async getSFDXCommand(
    sourceDirectory: string,
    packageDirectory: string
  ): Promise<SFDXCommand> {
    //Determine package type
    let packageType: string = this.determinePackageType(
      path.join(sourceDirectory, packageDirectory)
    );

    //Pick the type of SFDX command to use
    let dataPackageDeployer: SFDXCommand;
    if (packageType === "sfdmu") {
      let orgDomainUrl = await new OrgDetailsFetcher(
        this.targetusername
      ).getOrgDomainUrl();

      dataPackageDeployer = new SFDMURunImpl(
        sourceDirectory,
        this.targetusername,
        orgDomainUrl,
        packageDirectory,
        this.logger,
        this.logLevel
      );
    } else if (packageType === "vlocity") {
      dataPackageDeployer = new VlocityPackDeployImpl(
        this.sourceDirectory,
        this.targetusername,
        packageDirectory,
        null,
        null
      );
    } else {
      throw new Error("Unsupported package type");
    }

    return dataPackageDeployer;
  }

  private determinePackageType(packageDirectory: string): string {
    if (fs.pathExistsSync(path.join(packageDirectory, "export.json"))) {
      SFPLogger.log(
        `Found export.json in ${packageDirectory}.. Utilizing it as data package and will be deployed using sfdmu`,
        LoggerLevel.INFO,
        this.logger
      );
      return "sfdmu";
    } else if (
      fs.pathExistsSync(path.join(packageDirectory, "VlocityComponents.yaml"))
    ) {
      SFPLogger.log(
        `Found VlocityComponents.yaml in ${packageDirectory}.. Utilizing it as data package and will be deployed using vbt`,
        LoggerLevel.INFO,
        this.logger
      );
      return "vlocity";
    } else {
      throw new Error(
        `Could not find export.json or VlocityComponents.yaml in ${packageDirectory}. sfpowerscripts only support vlocity or sfdmu based data packages`
      );
    }
  }
}
