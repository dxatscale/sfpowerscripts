import { SFPPackage } from "../SFPPackage";
import { PropertyFetcher } from "./PropertyFetcher"

import * as fs from "fs-extra";

@PropertyFetcher.register
export class PreDeploymentScriptFetcher {
  getSfpowerscriptsProperties(
    packageContents: SFPPackage,
    packageLogger?: any
  ) {
    if (packageContents.packageDescriptor.preDeploymentScript) {
      if (
        fs.existsSync(packageContents.packageDescriptor.preDeploymentScript)
      ) {
        packageContents.preDeploymentScript =
          packageContents.packageDescriptor.preDeploymentScript;
      } else {
        throw new Error(
          `preDeploymentScript ${packageContents.packageDescriptor.preDeploymentScript} does not exist`
        );
      }
      return packageContents;
    }
  }
}
