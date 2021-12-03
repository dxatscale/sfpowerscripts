import PackageMetadata from "../../PackageMetadata";
import SFPLogger, { Logger, LoggerLevel } from "../../logger/SFPLogger";
import PackageMetadataPrinter from "../../display/PackageMetadataPrinter";
import { InstallPackage } from "./InstallPackage";
import InstalledPackagesFetcher from "../packageQuery/InstalledPackagesFetcher";
import InstallUnlockedPackageWrapper from "../../sfdxwrappers/InstallUnlockedPackageImpl";

export default class InstallUnlockedPackageImpl extends InstallPackage {
  private packageVersionId;
  private options;

  public constructor(
    sfdxPackage: string,
    targetusername: string,
    options: any,
    skipIfPackageInstalled: boolean,
    packageMetadata: PackageMetadata,
    sourceDirectory: string,
    logger: Logger,
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
    this.packageVersionId = packageMetadata.package_version_id;
    this.options = options;
  }

  public async install() {
    //Print Metadata carried in the package
    PackageMetadataPrinter.printMetadataToDeploy(
      this.packageMetadata?.payload,
      this.logger
    );

    let installUnlockedPackageWrapper: InstallUnlockedPackageWrapper = new InstallUnlockedPackageWrapper(
      this.logger,
      LoggerLevel.INFO,
      null,
      this.targetusername,
      this.packageVersionId,
      this.options["waitTime"],
      this.options["publishWaitTime"],
      this.options["installationkey"],
      this.options["securitytype"],
      this.options["upgradetype"]
    );
    SFPLogger.log(`Executing installation command: ${installUnlockedPackageWrapper.getGeneratedSFDXCommandWithParams()}`)
    await installUnlockedPackageWrapper.exec(false);
  }

  protected async isPackageToBeInstalled( skipIfPackageInstalled: boolean): Promise<boolean> {
    try {
      if(skipIfPackageInstalled)
      {
      SFPLogger.log(
        `Checking Whether Package with ID ${this.packageVersionId} is installed in  ${this.targetusername}`,
        null,
        this.logger
      );
      let installedPackages = await new InstalledPackagesFetcher(
        this.connection
      ).fetchAllPackages();

      let packageFound = installedPackages.find((installedPackage) => {
        return (
          installedPackage.subscriberPackageVersionId ===
          this.packageVersionId
        );
      });

      if (packageFound) {
        SFPLogger.log(
          `Package to be installed was found in the target org  ${this.targetusername}`,
          LoggerLevel.INFO,
          this.logger
        );
        return false;
      } else 
      {
        SFPLogger.log(
          `Package to be installed was not found in the target org  ${this.targetusername}, Proceeding to instal.. `,
          LoggerLevel.INFO,
          this.logger
        );
        return true;
      }
     }
     else
     {
      SFPLogger.log(
        "Skip if package to be installed is false, Proceeding with installation",
        LoggerLevel.INFO,
        this.logger
      );
      return true;
     }
    } catch (error) {
      SFPLogger.log(
        "Unable to check whether this package is installed in the target org",
        LoggerLevel.INFO,
        this.logger
      );
      return true;
    }
  }
}
