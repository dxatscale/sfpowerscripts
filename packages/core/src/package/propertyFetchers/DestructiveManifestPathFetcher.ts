import * as fs from "fs-extra";
import SFPLogger from "../../utils/SFPLogger";
import { SFPPackage } from "../SFPPackage";
import { PropertyFetcher } from "./PropertyFetcher";


@PropertyFetcher.register
export class DestructiveManifestPathFetcher
{
 
  public getSfpowerscriptsProperties(packageContents:SFPPackage, packageLogger?:any) {
    let destructiveChangesPath: string;

    if (packageContents.packageDescriptor === null || packageContents.packageDescriptor === undefined) {
      throw ("Project Config (sfdx-project.json) is null")
    }

      if (packageContents.packageDescriptor["destructiveChangePath"]) {
        destructiveChangesPath = packageContents.packageDescriptor["destructiveChangePath"];
        packageContents.destructiveChangesPath=destructiveChangesPath;
      }
    

    try {
      if (destructiveChangesPath!=null) {
        packageContents.destructiveChanges = JSON.parse(
          fs.readFileSync(destructiveChangesPath, "utf8")
        );
      }
    } catch (error) {
      SFPLogger.log(
        "Unable to process destructive Manifest specified in the path or in the project manifest",
        null,
        packageLogger
      );
      packageContents.destructiveChanges = null;
    }
    return packageContents;
  }
}

