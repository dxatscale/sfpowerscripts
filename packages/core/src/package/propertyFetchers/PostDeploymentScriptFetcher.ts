import SFPPackage  from "../SFPPackage";
import  PropertyFetcher  from "./PropertyFetcher"

import * as fs from "fs-extra";

export default class PostDeploymentScriptFetcher implements PropertyFetcher {
  getSfpowerscriptsProperties(
    packageContents: SFPPackage,
    packageLogger?: any
  ) {
    if (packageContents.packageDescriptor.postDeploymentScript) {
      if (
        fs.existsSync(packageContents.packageDescriptor.postDeploymentScript)
      ) {
        packageContents.postDeploymentScript =
          packageContents.packageDescriptor.postDeploymentScript;
      } else {
        throw new Error(
          `preDeploymentScript ${packageContents.packageDescriptor.postDeploymentScript} does not exist`
        );
      }
      return packageContents;
    }
  }
}
