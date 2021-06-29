import * as fs from "fs-extra";
import SFPPackage  from "../SFPPackage";
import  PropertyFetcher  from "./PropertyFetcher";
import xml2json from "../../utils/xml2json";
import { Logger } from "../../logger/SFPLogger";

export default class DestructiveManifestPathFetcher implements PropertyFetcher {

  public async getSfpowerscriptsProperties(packageContents:SFPPackage, packageLogger?:Logger) {
    let destructiveChangesPath: string;

    if (packageContents.packageDescriptor === null || packageContents.packageDescriptor === undefined) {
      throw (new Error("Project Config (sfdx-project.json) is null"))
    }

      if (packageContents.packageDescriptor["destructiveChangePath"]) {
        destructiveChangesPath = packageContents.packageDescriptor["destructiveChangePath"];
        packageContents.destructiveChangesPath=destructiveChangesPath;
      }


    try {
      if (destructiveChangesPath!=null) {
        packageContents.destructiveChanges = await xml2json(fs.readFileSync(destructiveChangesPath, "utf8"));
      }
    } catch (error) {
      throw new Error("Unable to process destructive Manifest specified in the path or in the project manifest");
    }
    return packageContents;
  }
}
