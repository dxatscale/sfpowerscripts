const Table = require("cli-table");
import SFPLogger, { Logger, LoggerLevel, COLOR_KEY_MESSAGE } from "../logger/SFPLogger";
import PackageDetails from "../package/PackageDetails";

export default class InstalledPackagesDisplayer {

  public static printInstalledPackages(packages: PackageDetails[], logger: Logger) {

    if (packages == null) return;

    let table = new Table({
      head: ["Package", "Version", "Type", "isOrgDependent"],
    });

    packages.forEach((pkg) => {
      table.push([pkg.name, pkg.versionNumber, pkg.type, pkg.isOrgDependent]);
    });

    SFPLogger.log(
      COLOR_KEY_MESSAGE("Packages installed in org:"),
      LoggerLevel.INFO,
      logger
    );
    SFPLogger.log(table.toString(), LoggerLevel.INFO, logger);



  }
}
