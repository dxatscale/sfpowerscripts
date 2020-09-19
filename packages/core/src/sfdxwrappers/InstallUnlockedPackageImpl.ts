import child_process = require("child_process");
import { isNullOrUndefined } from "util";
import { onExit } from "../utils/OnExit";
import PackageMetadata from "../PackageMetadata";
import ManifestHelpers from "../manifest/ManifestHelpers";

export default class InstallUnlockedPackageImpl {
  public constructor(
    private package_version_id: string,
    private targetusername: string,
    private options: any,
    private wait_time: string,
    private publish_wait_time: string,
    private skip_if_package_installed: boolean,
    private packageMetadata:PackageMetadata
  ) {}

  public async exec(): Promise<PackageInstallationResult> {



    let isPackageInstalled = false;
    if (this.skip_if_package_installed) {
      isPackageInstalled = this.checkWhetherPackageIsIntalledInOrg();
    }

    if (!isPackageInstalled) {

     //Print Metadata carried in the package
     ManifestHelpers.printMetadataToDeploy(this.packageMetadata.payload);

      let command = this.buildPackageInstallCommand();
      let child = child_process.exec(command, (error, stdout, stderr) => {
        if (error) {
          throw error;
        }
      });

      child.stdout.on("data", (data) => {
        console.log(data.toString());
      });

      await onExit(child);
      return PackageInstallationResult.Succeeded;
    } else {
      console.log("Skipping Package Installation")
      return PackageInstallationResult.Skipped
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

    console.log(`Generated Command ${command}`);
    return command;
  }

  private checkWhetherPackageIsIntalledInOrg(): boolean {
    try {
      console.log(`Checking Whether Package with ID ${this.package_version_id} is installed in  ${this.targetusername}`)
      let command = `sfdx sfpowerkit:package:version:info  -u ${this.targetusername} --json`;
      let result = JSON.parse(child_process.execSync(command).toString());
      if (result.status == 0) {
        let packageInfos: PackageInfo[] = result.result;
        let packageFound = packageInfos.find((packageInfo) => {
          if(packageInfo.packageVersionId == this.package_version_id)
          return true;
        });
        if (packageFound) {
          console.log(
            "Package To be installed was found in the target org",
            packageFound
          );
          return true;
        }
      }
    } catch (error) {
      console.log(
        "Unable to check whether this package is installed in the target org"
      );
      return false;
    }
  }
}

export enum PackageInstallationResult {
  Skipped,
  Succeeded
}

type PackageInfo= {
  packageName: string;
  subcriberPackageId: string;
  packageNamespacePrefix: string;
  packageVersionId: string;
  packageVersionNumber: string;
  allowedLicenses: number;
  usedLicenses: number;
  expirationDate: string;
  status: string;
}
