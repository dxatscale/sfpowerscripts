import child_process = require("child_process");
import { isNullOrUndefined } from "util";
import { onExit } from "../OnExit";
import { loadSFDX } from "../GetNodeWrapper";
import { sfdx } from "../sfdxnode/parallel";
import { type } from "os";

export default class InstallUnlockedPackageImpl {
  public constructor(
    private package_version_id: string,
    private targetusername: string,
    private options: any,
    private wait_time: string,
    private publish_wait_time: string,
    private skipIfAlreadyInstalled: boolean,
    private moduleDir: string
  ) {}

  public async exec(): Promise<void> {

    console.log("--------Installing an unlocked package to an org--------------")
    //load sfdx plugin and sfpowerkit
    await loadSFDX(this.moduleDir);

    //get all packages in the org
    let isPackageAlreadyInstalled = false;

    if (this.skipIfAlreadyInstalled) {
      console.log("Fetching all installed packages in the org");

      try {
        let packageInfos: PackageInfo[] = await sfdx.sfpowerkit.package.version.info(
          {
            targetusername: this.targetusername,
            quiet: true,
          }
        );
        let packageFound = packageInfos.find((packageInfo) => {
          if (packageInfo.packageVersionId == this.package_version_id)
            return true;
        });
        if (packageFound) {
          console.log("Package To be installed was found in the target org",packageFound);
          isPackageAlreadyInstalled = true;
        }
      } catch (error) {
        console.log("Unable to package version infos, skipping the check")
        isPackageAlreadyInstalled = false;
      }
    }

    if (this.skipIfAlreadyInstalled && isPackageAlreadyInstalled) {
      console.log(
        "The package is already installed in the org, skipping installation"
      );
    } else {
      let parameters = {
        quiet: false,
        package: this.package_version_id,
        targetusername: this.targetusername,
        noprompt: true,
        publishwait: this.publish_wait_time,
        wait: this.wait_time,
        securitytype: this.options["securitytype"],
        upgradetype: this.options["upgradetype"],
        apexcompile: this.options["apexcompile"],
      };

      if (!isNullOrUndefined(this.options["installationkey"]))
        parameters["installationkey"] = this.options["installationkey"];

      console.log("Parameters for the installation",parameters);
      await sfdx.force.package.install(parameters);
    }
  }
}
interface PackageInfo {
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
