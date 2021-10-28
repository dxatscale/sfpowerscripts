import path from "path";
import * as fs from "fs-extra";
import { ApexClasses } from "./SFPPackage";
import xml2json from "../utils/xml2json";

export default class PackageManifest
{

  private _manifest;

  /**
   * Getter for package manifest JSON
   */
  get manifest() {
    return this._manifest;
  }

  private constructor(){};

  /**
   *
   * @returns package manifest in dir, as JSON
   */
   private async parseManifest(dir: string): Promise<any> {
    const packageXml: string = fs.readFileSync(
      path.join(dir, "package.xml"),
      "utf8"
    );
    return xml2json(packageXml);
  }

  /**
   * Factory method
   * @param mdapiDir directory containing package.xml
   * @returns instance of PackageManifest
   */
  static async create(mdapiDir: string): Promise<PackageManifest> {
    const packageManifest = new PackageManifest();
    packageManifest._manifest = await packageManifest.parseManifest(mdapiDir);

    return packageManifest;
  }

  /**
   *
   * @returns true or false, for whether there are profiles
   */
  public isProfilesInPackage(): boolean {
    let isProfilesFound = false;

    if (this._manifest.Package.types) {
      if (Array.isArray(this._manifest.Package.types)) {
        for (let type of this._manifest.Package.types) {
          if (type.name === "Profile") {
            isProfilesFound = true;
            break;
          }
        }
      } else if (this._manifest.Package.types.name === "Profile") {
        isProfilesFound = true;
      }
    }

    return isProfilesFound;
  }

  /**
   *
   * @returns true or false, for whether there are Apex classes and/or triggers
   */
  public isApexInPackage(): boolean {
    let isApexFound = false;

    if (this._manifest.Package.types) {
      if (Array.isArray(this._manifest.Package.types)) {
        for (let type of this._manifest.Package.types) {
          if (type.name === "ApexClass" || type.name === "ApexTrigger") {
            isApexFound = true;
            break;
          }
        }
      } else if (
        this._manifest.Package.types.name === "ApexClass" ||
        this._manifest.Package.types.name === "ApexTrigger"
      ) {
        isApexFound = true;
      }
    }

    return isApexFound;
  }

  /**
   *
   * @returns Apex triggers if there are any, otherwise returns undefined
   */
  public fetchTriggers(): ApexClasses {
    let triggers: string[];

    let types;
    if (this._manifest.Package.types) {
      if (this._manifest.Package.types instanceof Array) {
        types = this._manifest.Package.types;
      } else {
        // Create array with single type
        types = [this._manifest.Package.types];
      }
    }

    if (types) {
      for (let type of types) {
        if (type.name === "ApexTrigger") {
          if (type.members instanceof Array) {
            triggers = type.members;
          } else {
            // Create array with single member
            triggers = [type.members];
          }
          break;
        }
      }
    }

    return triggers;
  }
}
