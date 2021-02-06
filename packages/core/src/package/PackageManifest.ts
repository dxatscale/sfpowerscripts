import path from "path";
import * as fs from "fs-extra";
import { ApexClasses } from "./SFPPackage";
import xml2json from "../utils/xml2json";

export default class PackageManifest
{

  private manifest;

  public constructor(private mdapiDir:string){};

  public async getManifest() {
    let packageXml: string = fs.readFileSync(
      path.join(this.mdapiDir, "package.xml"),
      "utf8"
    );
    this.manifest = await xml2json(packageXml);
    return this.manifest;
  }

  public isProfilesInPackage(): boolean {
    let isProfilesFound = false;
    if (Array.isArray(this.manifest["Package"]["types"])) {
      for (let type of this.manifest["Package"]["types"]) {
        if (type["name"] == "Profile") {
          isProfilesFound = true;
          break;
        }
      }
    } else if (this.manifest["Package"]["types"]["name"] == "Profile") {
      isProfilesFound = true;
    }
    return isProfilesFound;
  }

  public isApexInPackage(): boolean {
    let isApexFound = false;
    if (Array.isArray(this.manifest["Package"]["types"])) {
      for (let type of this.manifest["Package"]["types"]) {
        if (type["name"] == "ApexClass" || type["name"] == "ApexTrigger") {
          isApexFound = true;
          break;
        }
      }
    } else if (
      this.manifest["Package"]["types"]["name"] == "ApexClass" ||
      this.manifest["Package"]["types"]["name"] == "ApexTrigger"
    ) {
      isApexFound = true;
    }
    return isApexFound;
  }

  public fetchTriggers(): ApexClasses {
    let triggers: string[];

    let types;
    if (this.manifest["Package"]["types"] instanceof Array) {
      types = this.manifest["Package"]["types"];
    } else {
      // Create array with single type
      types = [this.manifest["Package"]["types"]];
    }

    for (let type of types) {
      if (type["name"] === "ApexTrigger") {
        if (type["members"] instanceof Array) {
          triggers = type["members"];
        } else {
          // Create array with single member
          triggers = [type["members"]];
        }
        break;
      }
    }

    return triggers;
  }


}
