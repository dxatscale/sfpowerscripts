import ApexTypeFetcher from "../parser/ApexTypeFetcher";
import ProjectConfig from "../project/ProjectConfig";
import path from "path";
import SourcePackageGenerator from "../generators/SourcePackageGenerator";
import { PropertyFetcher } from "./propertyFetchers/PropertyFetcher";
import ConvertSourceToMDAPIImpl from "../sfdxwrappers/ConvertSourceToMDAPIImpl";
import PackageManifest from "./PackageManifest";

const glob = require("glob");

export type ApexClasses = Array<string>;
export default class SFPPackage {
  private _package_name: string;
  private _packageDescriptor: any;
  private _mdapiDir: string;
  private _metadataCount: number;
  private _payload: any;
  private _packageType: string;
  private _apexTestClassses: ApexClasses;
  private _apexClassWithOutTestClasses: ApexClasses;
  private _triggers: ApexClasses;
  private _isApexInPackage: boolean;
  private _isProfilesInPackage: boolean;
  private _configFilePath: string;
  private _projectDirectory: string;

  public assignPermSetsPreDeployment?: string[];
  public assignPermSetsPostDeployment?: string[];
  public destructiveChangesPath: string;
  public destructiveChanges?: any;
  public reconcileProfiles: boolean;
  public postDeploymentScript: string;
  public preDeploymentScript: string;

  private constructor() {}

  public get configFilePath() {
    return this._configFilePath;
  }

  public get package_name() {
    return this._package_name;
  }

  public get payload() {
    return this._payload;
  }

  public get mdapiDir() {
    return this._mdapiDir;
  }

  public get metadataCount() {
    return this._metadataCount;
  }

  public get packageType() {
    return this._packageType;
  }

  public get packageDescriptor() {
    return this._packageDescriptor;
  }

  private getApexTestClasses(): ApexClasses {
    if (this._apexTestClassses == null) {
      let apexTypeFetcher: ApexTypeFetcher = new ApexTypeFetcher();
      let apexSortedByType = apexTypeFetcher.getApexTypeOfClsFiles(
        path.join(this.mdapiDir, `classes`)
      );

      if (apexSortedByType["parseError"].length > 0) {
        for (let parseError of apexSortedByType["parseError"]) {
          console.log(`Failed to parse ${parseError.name}`);
        }
      }

      let testClassNames: string[] = apexSortedByType["testClass"].map(
        (fileDescriptor) => fileDescriptor.name
      );

      if (testClassNames.length === 0) {
        throw new Error("No test classes found in package");
      }

      this._apexTestClassses = testClassNames;
    }
    return this._apexTestClassses;
  }

  public get apexTestClassses(): ApexClasses {
    return this._apexTestClassses;
  }

  private getApexClassExcludingTestClasses(): ApexClasses {
    if (this._apexClassWithOutTestClasses == null) {
      let packageClasses: string[];

      let apexTypeFetcher: ApexTypeFetcher = new ApexTypeFetcher();
      let apexSortedByType = apexTypeFetcher.getApexTypeOfClsFiles(
        path.join(this.mdapiDir, `classes`)
      );

      let types;
      if (this.payload["Package"]["types"] instanceof Array) {
        types = this.payload["Package"]["types"];
      } else {
        // Create array with single type
        types = [this.payload["Package"]["types"]];
      }

      for (let type of types) {
        if (type["name"] === "ApexClass") {
          if (type["members"] instanceof Array) {
            packageClasses = type["members"];
          } else {
            // Create array with single member
            packageClasses = [type["members"]];
          }
          break;
        }
      }

      if (packageClasses != null) {
        if (apexSortedByType["testClass"].length > 0) {
          // Filter out test classes
          packageClasses = packageClasses.filter((packageClass) => {
            for (let testClass of apexSortedByType["testClass"]) {
              if (testClass["name"] === packageClass) {
                return false;
              }
            }

            if (apexSortedByType["parseError"].length > 0) {
              // Filter out undetermined classes that failed to parse
              for (let parseError of apexSortedByType["parseError"]) {
                if (parseError["name"] === packageClass) {
                  console.log(
                    `Skipping  ${packageClass}, unable to determine identity of class`
                  );
                  return false;
                }
              }
            }

            return true;
          });
        }

        if (apexSortedByType["interface"].length > 0) {
          // Filter out interfaces
          packageClasses = packageClasses.filter((packageClass) => {
            for (let interfaceClass of apexSortedByType["interface"]) {
              if (interfaceClass["name"] === packageClass) {
                return false;
              }
            }
            return true;
          });
        }
      }
      this._apexClassWithOutTestClasses = packageClasses;
    }
    return this._apexClassWithOutTestClasses;
  }

  public get apexClassWithOutTestClasses(): ApexClasses {
    return this._apexClassWithOutTestClasses;
  }

  private fetchTriggers(): ApexClasses {
    let triggers: string[];

    let types;
    if (this.payload["Package"]["types"] instanceof Array) {
      types = this.payload["Package"]["types"];
    } else {
      // Create array with single type
      types = [this.payload["Package"]["types"]];
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

  public get triggers(): ApexClasses {
    return this._triggers;
  }

  public static async buildPackageFromProjectConfig(
    projectDirectory: string,
    sfdx_package: string,
    configFilePath?: string,
    packageLogger?: any
  ) {
    let sfpPackage: SFPPackage = new SFPPackage();
    sfpPackage._package_name = sfdx_package;
    sfpPackage._packageDescriptor = ProjectConfig.getSFDXPackageDescriptor(
      projectDirectory,
      sfdx_package
    );
    sfpPackage._projectDirectory = projectDirectory;
    
    sfpPackage._mdapiDir = await new ConvertSourceToMDAPIImpl(projectDirectory,sfpPackage._packageDescriptor.path,packageLogger).exec(true);
    sfpPackage._payload = await new PackageManifest(sfpPackage.mdapiDir).getManifest();
    sfpPackage._triggers = sfpPackage.fetchTriggers();
    sfpPackage._isApexInPackage = sfpPackage.checkForApexInPackage();
    sfpPackage._isProfilesInPackage = sfpPackage.checkForProfilesInPackage();
    sfpPackage._packageType = ProjectConfig.getPackageType(
      ProjectConfig.getSFDXPackageManifest(projectDirectory),
      sfdx_package
    );
    sfpPackage._apexTestClassses = sfpPackage.getApexTestClasses();
    sfpPackage._metadataCount = sfpPackage.getMetadataCount(
      projectDirectory,
      sfpPackage._packageDescriptor.path
    );
    sfpPackage._apexClassWithOutTestClasses = sfpPackage.getApexClassExcludingTestClasses();

    let propertyFetcherRegister = PropertyFetcher.GetImplementations();
    for (const element in propertyFetcherRegister) {
      const propertyFetcher = new PropertyFetcher[element]();
      propertyFetcher.getSfpowerscriptsProperties(sfpPackage, packageLogger);
    }

    return sfpPackage;
  }

  public createAWorkingDirectory() {
    let workingDirectory = SourcePackageGenerator.generateSourcePackageArtifact(
      this._projectDirectory,
      this._package_name,
      this._packageDescriptor.path,
      this.destructiveChangesPath,
      this.configFilePath
    );
    return workingDirectory;
  }

  private getMetadataCount(
    projectDirectory: string,
    sourceDirectory: string
  ): number {
    let metadataCount;
    try {
      let metadataFiles: string[] = glob.sync(`**/*-meta.xml`, {
        cwd: projectDirectory
          ? path.join(projectDirectory, sourceDirectory)
          : sourceDirectory,
        absolute: true,
      });
      metadataCount = metadataFiles.length;
    } catch (error) {
      metadataCount = -1;
    }
    return metadataCount;
  }



  private checkForApexInPackage(): boolean {
    let isApexFound = false;
    if (Array.isArray(this.payload["Package"]["types"])) {
      for (let type of this.payload["Package"]["types"]) {
        if (type["name"] == "ApexClass" || type["name"] == "ApexTrigger") {
          isApexFound = true;
          break;
        }
      }
    } else if (
      this.payload["Package"]["types"]["name"] == "ApexClass" ||
      this.payload["Package"]["types"]["name"] == "ApexTrigger"
    ) {
      isApexFound = true;
    }
    return isApexFound;
  }

  public get isApexInPackage(): boolean {
    return this._isApexInPackage;
  }

  private checkForProfilesInPackage(): boolean {
    let isProfilesFound = false;
    if (Array.isArray(this.payload["Package"]["types"])) {
      for (let type of this.payload["Package"]["types"]) {
        if (type["name"] == "Profile") {
          isProfilesFound = true;
          break;
        }
      }
    } else if (this.payload["Package"]["types"]["name"] == "Profile") {
      isProfilesFound = true;
    }
    return isProfilesFound;
  }

  public get isProfilesInPackage(): boolean {
    return this._isProfilesInPackage;
  }
}
