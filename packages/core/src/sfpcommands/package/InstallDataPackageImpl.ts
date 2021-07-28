import PackageMetadata from "../../PackageMetadata";
import fs = require("fs-extra");
import ArtifactInstallationStatusChecker from "../../artifacts/ArtifactInstallationStatusChecker";
import {
  PackageInstallationResult,
  PackageInstallationStatus,
} from "../../package/PackageInstallationResult";
import ProjectConfig from "../../project/ProjectConfig";
import SFPLogger, { Logger, LoggerLevel } from "../../logger/SFPLogger";
import PackageInstallationHelpers from "./PackageInstallationHelpers";
import ArtifactInstallationStatusUpdater from "../../artifacts/ArtifactInstallationStatusUpdater";
import SFPStatsSender from "../../stats/SFPStatsSender";
import { AuthInfo, Connection } from "@salesforce/core";
import { convertAliasToUsername } from "../../utils/AliasList";
import SFDMURunImpl from "../../sfdmuwrapper/SFDMURunImpl";
import VlocityPackDeployImpl from "../../vlocitywrapper/VlocityPackDeployImpl";
import { SFDXCommand } from "../../command/SFDXCommand";
const path = require("path");

export default class InstallDataPackageImpl {
  public constructor(
    private sfdx_package: string,
    private targetusername: string,
    private sourceDirectory: string,
    private packageMetadata: PackageMetadata,
    private skip_if_package_installed: boolean,
    private logger?: Logger,
    private logLevel?:LoggerLevel
  ) {}

  public async exec(): Promise<PackageInstallationResult> {
    let packageDirectory: string;

    try {
      let startTime = Date.now();
      let packageDescriptor = ProjectConfig.getSFDXPackageDescriptor(
        this.sourceDirectory,
        this.sfdx_package
      );

      //Create a conncetion to the target org for api calls
      const connection: Connection = await Connection.create({
        authInfo: await AuthInfo.create({ username: convertAliasToUsername(this.targetusername) }),
      });

      if (packageDescriptor.aliasfy) {
        packageDirectory = path.join(
          packageDescriptor["path"],
          this.targetusername
        );
      } else {
        packageDirectory = path.join(packageDescriptor["path"]);
      }

      let absPackageDirectory: string = path.join(
        this.sourceDirectory,
        packageDirectory
      );
      if (!fs.existsSync(absPackageDirectory)) {
        throw new Error(
          `Source directory ${absPackageDirectory} does not exist`
        );
      }

      let isPackageInstalled = false;
      if (this.skip_if_package_installed) {
        let installationStatus = await ArtifactInstallationStatusChecker.checkWhetherPackageIsIntalledInOrg(
          this.logger,
          this.targetusername,
          this.packageMetadata
        );
        isPackageInstalled = installationStatus.isInstalled;

        if (isPackageInstalled) {
          SFPLogger.log(
            "Skipping Package Installation",
            null,
            this.logger
          );
          return { result: PackageInstallationStatus.Skipped };
        }
      }

      let preDeploymentScript: string = path.join(
        this.sourceDirectory,
        `scripts`,
        `preDeployment`
      );

      if (fs.existsSync(preDeploymentScript)) {
        console.log("Executing preDeployment script");
        await PackageInstallationHelpers.executeScript(
          preDeploymentScript,
          this.sfdx_package,
          this.targetusername,
          this.logger
        );
      }

      if (this.packageMetadata.assignPermSetsPreDeployment) {
        SFPLogger.log(
          "Assigning permission sets before deployment:",
          LoggerLevel.INFO,
          this.logger
        );

        await PackageInstallationHelpers.applyPermsets(
          this.packageMetadata.assignPermSetsPreDeployment,
          connection,
          this.sourceDirectory,
          this.logger
        );
      }

    


      //Fetch the sfdxcommand executor for the type
      let dataPackageDeployer:SFDXCommand = this.getSFDXCommand(packageDirectory);
      let result = await dataPackageDeployer.exec(false);

      SFPLogger.log(result,LoggerLevel.INFO,this.logger);

      let postDeploymentScript: string = path.join(
        this.sourceDirectory,
        `scripts`,
        `postDeployment`
      );

      if (fs.existsSync(postDeploymentScript)) {
        console.log("Executing postDeployment script");
        await PackageInstallationHelpers.executeScript(
          postDeploymentScript,
          this.sfdx_package,
          this.targetusername,
          this.logger
        );
      }

      if (this.packageMetadata.assignPermSetsPostDeployment) {
        SFPLogger.log(
          "Assigning permission sets after deployment:",
          LoggerLevel.INFO,
          this.logger
        );

        await PackageInstallationHelpers.applyPermsets(
          this.packageMetadata.assignPermSetsPostDeployment,
          connection,
          this.sourceDirectory,
          this.logger
        );
      }

      await ArtifactInstallationStatusUpdater.updatePackageInstalledInOrg(
        this.logger,
        this.targetusername,
        this.packageMetadata
      );

      let elapsedTime = Date.now() - startTime;
      SFPStatsSender.logElapsedTime(
        "package.installation.elapsed_time",
        elapsedTime,
        {
          package: this.packageMetadata.package_name,
          type: "data",
          target_org: this.targetusername,
        }
      );
      SFPStatsSender.logCount("package.installation", {
        package: this.packageMetadata.package_name,
        type: "data",
        target_org: this.targetusername,
      });

      return { result: PackageInstallationStatus.Succeeded };
    } catch (err) {
      SFPStatsSender.logCount("package.installation.failure", {
        package: this.packageMetadata.package_name,
        type: "data",
        target_org: this.targetusername,
      });
      return { result: PackageInstallationStatus.Failed, message: err.message };
    } finally {
      let csvIssuesReportFilepath: string = path.join(
        this.sourceDirectory,
        packageDirectory,
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
    }
    
  }
  private getSFDXCommand(packageDirectory:string): SFDXCommand {

    //Determine package type
    let packageType:string = this.determinePackageType(packageDirectory);

    //Pick the type of SFDX command to use
    let dataPackageDeployer: SFDXCommand;
      if(packageType==="sfdmu")
      {
        dataPackageDeployer = new SFDMURunImpl(null,this.targetusername,packageDirectory,this.logger,this.logLevel);
        
      }
      else if(packageType==="vlocity")
      {
        dataPackageDeployer = new VlocityPackDeployImpl(null,this.targetusername,packageDirectory,null,null);
      }
      else
      {
        throw new Error("Unsupported package type");
      }

      return dataPackageDeployer;
  }

  private determinePackageType (packageDirectory: string):string {

    if (fs.pathExistsSync(path.join(packageDirectory, "export.json"))) {
      SFPLogger.log(
        `Found export.json in ${packageDirectory}.. Utilizing it as data package and will be deployed using sfdmu`,
        LoggerLevel.INFO,
        this.logger
      );
      return "sfdmu";
    }
    else if (fs.pathExistsSync(path.join(packageDirectory, "VlocityComponents.yaml"))) {
      SFPLogger.log(
        `Found VlocityComponents.yaml in ${packageDirectory}.. Utilizing it as data package and will be deployed using vbt`,
        LoggerLevel.INFO,
        this.logger
      );
      return "vlocity";
    }
    else {
      throw new Error(`Could not find export.json or VlocityComponents.yaml in ${packageDirectory}. sfpowerscripts only support vlocity or sfdmu based data packages`);
    }
  }

  
}
