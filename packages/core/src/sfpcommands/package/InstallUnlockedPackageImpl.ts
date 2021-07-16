import child_process = require("child_process");
import { isNullOrUndefined } from "util";
import { onExit } from "../../utils/OnExit";
import PackageMetadata from "../../PackageMetadata";
import { PackageInstallationResult, PackageInstallationStatus } from "../../package/PackageInstallationResult";
import SFPLogger, { Logger, LoggerLevel } from "../../logger/SFPLogger";
import PackageInstallationHelpers from "./PackageInstallationHelpers";
import path = require("path");
import fs = require("fs");
import PackageMetadataPrinter from "../../display/PackageMetadataPrinter";
import SFPStatsSender from "../../stats/SFPStatsSender";
import ArtifactInstallationStatusUpdater from "../../artifacts/ArtifactInstallationStatusUpdater";
import InstalledPackagesFetcher from "../../package/InstalledPackagesFetcher";
import { Org } from "@salesforce/core";

export default class InstallUnlockedPackageImpl {
  public constructor(
    private package_version_id: string,
    private targetusername: string,
    private options: any,
    private wait_time: string,
    private publish_wait_time: string,
    private skip_if_package_installed: boolean,
    private packageMetadata:PackageMetadata,
    private sourceDirectory?:string,
    private packageLogger?:Logger
  ) {}

  public async exec(): Promise<PackageInstallationResult> {
    try {
      let startTime = Date.now();
      let isPackageInstalled = false;
      if (this.skip_if_package_installed) {
        isPackageInstalled = await this.checkWhetherPackageIsIntalledInOrg();
      }

      if (!isPackageInstalled) {
        if (this.sourceDirectory) {
          let preDeploymentScript: string = path.join(
            this.sourceDirectory,
            `scripts`,
            `preDeployment`
          );

          if (fs.existsSync(preDeploymentScript)) {
            console.log("Executing preDeployment script",LoggerLevel.INFO,this.packageLogger);
            await PackageInstallationHelpers.executeScript(
              preDeploymentScript,
              this.packageMetadata.package_name,
              this.targetusername,
              this.packageLogger
            );
          }

          if (this.packageMetadata.assignPermSetsPreDeployment) {
            SFPLogger.log(
              "Assigning permission sets before deployment:",
              LoggerLevel.INFO,
              this.packageLogger
            );

            PackageInstallationHelpers.applyPermsets(
              this.packageMetadata.assignPermSetsPreDeployment,
              this.targetusername,
              this.sourceDirectory,
              this.packageLogger
            );
          }

        }

            //Print Metadata carried in the package
         PackageMetadataPrinter.printMetadataToDeploy(this.packageMetadata?.payload,this.packageLogger);

        let command = this.buildPackageInstallCommand();
        let child = child_process.exec(command);

        child.stderr.on("data", (data) => {
          SFPLogger.log(data.toString(),LoggerLevel.INFO,this.packageLogger);
        });

        child.stdout.on("data", (data) => {
          SFPLogger.log(data.toString(),LoggerLevel.INFO,this.packageLogger);
        });


        await onExit(child);


        if(this.sourceDirectory) {
          let postDeploymentScript: string = path.join(
            this.sourceDirectory,
            `scripts`,
            `postDeployment`
          );

          if (fs.existsSync(postDeploymentScript)) {
            console.log("Executing postDeployment script",LoggerLevel.INFO,this.packageLogger);
            await PackageInstallationHelpers.executeScript(
              postDeploymentScript,
              this.packageMetadata.package_name,
              this.targetusername,
              this.packageLogger
            );
          }

          if (this.packageMetadata.assignPermSetsPostDeployment) {
            SFPLogger.log(
              "Assigning permission sets after deployment:",
              LoggerLevel.INFO,
              this.packageLogger
            );

            PackageInstallationHelpers.applyPermsets(
              this.packageMetadata.assignPermSetsPostDeployment,
              this.targetusername,
              this.sourceDirectory,
              this.packageLogger
            )
          }
        }


        await ArtifactInstallationStatusUpdater.updatePackageInstalledInOrg(
          this.packageLogger,
          this.targetusername,
          this.packageMetadata
        );


        let elapsedTime = Date.now() - startTime;
        SFPStatsSender.logElapsedTime(
          "package.installation.elapsed_time",
          elapsedTime,
          {
            package: this.packageMetadata.package_name,
            type: "unlocked",
            target_org: this.targetusername,
          }
        );
        SFPStatsSender.logCount("package.installation", {
          package: this.packageMetadata.package_name,
          type: "unlocked",
          target_org: this.targetusername,
        });

        return { result: PackageInstallationStatus.Succeeded}
      } else {
        SFPLogger.log("Skipping Package Installation",null,this.packageLogger)
        return { result: PackageInstallationStatus.Skipped }
      }
    } catch (err) {

      SFPStatsSender.logCount("package.installation.failure", {
        package: this.packageMetadata.package_name,
        type: "unlocked",
        target_org: this.targetusername,
      });

      return {
        result: PackageInstallationStatus.Failed,
        message: err.message
      }
    }
  }


  private buildPackageInstallCommand(): string {
    let command = `sfdx force:package:install --package ${this.package_version_id} -u ${this.targetusername} --noprompt`;

    command += ` --publishwait=${this.publish_wait_time}`;
    command += ` --wait=${this.wait_time}`;
    command += ` --securitytype=${this.options["securitytype"]}`;
    command += ` --upgradetype=${this.options["upgradetype"]}`;
    command += ` --apexcompile=${this.options["apexcompile"]}`;

    if (!isNullOrUndefined(this.options["installationkey"]))
      command += ` --installationkey=${this.options["installationkey"]}`;

    SFPLogger.log(`Generated Command ${command}`,null,this.packageLogger);
    return command;
  }

  private async checkWhetherPackageIsIntalledInOrg(): Promise<boolean> {
    try {
      let conn = (await Org.create({aliasOrUsername: this.targetusername})).getConnection(); // TODO: REFACTOR CLASS TO TAKE CONNECTION IN CONSTRUCTOR

      SFPLogger.log(`Checking Whether Package with ID ${this.package_version_id} is installed in  ${this.targetusername}`,null,this.packageLogger);
      let installedPackages = await new InstalledPackagesFetcher(conn).fetchAllPackages();

      let packageFound = installedPackages.find((installedPackage) => {
        return installedPackage.subscriberPackageVersionId === this.package_version_id
      });

      if (packageFound) {
        SFPLogger.log(
          `Package to be installed was found in the target org ${packageFound}`,
          LoggerLevel.INFO,
          this.packageLogger
        );
        return true;
      } else return false;

    } catch (error) {
      SFPLogger.log(
        "Unable to check whether this package is installed in the target org",LoggerLevel.INFO,this.packageLogger
      );
      return false;
    }
  }
}
