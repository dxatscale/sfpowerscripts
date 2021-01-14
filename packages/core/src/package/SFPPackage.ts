import ApexTypeFetcher, { ApexSortedByType } from "../parser/ApexTypeFetcher";
import ProjectConfig from "../project/ProjectConfig";
import SourcePackageGenerator from "../generators/SourcePackageGenerator";
import ConvertSourceToMDAPIImpl from "../sfdxwrappers/ConvertSourceToMDAPIImpl";
import PackageManifest from "./PackageManifest";
import MetadataCount from "./MetadataCount";

import PropertyFetcher from "./propertyFetchers/PropertyFetcher";
import AssignPermissionSetFetcher from "./propertyFetchers/AssignPermissionSetFetcher";
import DestructiveManifestPathFetcher from "./propertyFetchers/DestructiveManifestPathFetcher";
import PostDeploymentScriptFetcher from "./propertyFetchers/PostDeploymentScriptFetcher";
import PreDeploymentScriptFetcher from "./propertyFetchers/PreDeploymentScriptFetcher";
import ReconcilePropertyFetcher from "./propertyFetchers/ReconcileProfilePropertyFetcher";

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
  private _apexClassesSortedByTypes:ApexSortedByType;

  private readonly _propertyFetchers: PropertyFetcher[] = [
    new AssignPermissionSetFetcher(),
    new DestructiveManifestPathFetcher(),
    new PostDeploymentScriptFetcher(),
    new PreDeploymentScriptFetcher(),
    new ReconcilePropertyFetcher()
  ]

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


  public get apexTestClassses(): ApexClasses {
    return this._apexTestClassses;
  }



  public get apexClassWithOutTestClasses(): ApexClasses {
    return this._apexClassWithOutTestClasses;
  }

  public get apexClassesSortedByTypes():ApexSortedByType {
    return this._apexClassesSortedByTypes;
  }

  public get triggers(): ApexClasses {
    return this._triggers;
  }

  public get propertyFetchers(): PropertyFetcher[] {
    return this._propertyFetchers;
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
    if(configFilePath==null)
      sfpPackage._configFilePath="config/project-scratch-def.json";
    else
      sfpPackage._configFilePath=configFilePath;
    sfpPackage._mdapiDir = await new ConvertSourceToMDAPIImpl(
      projectDirectory,
      sfpPackage._packageDescriptor.path,
      packageLogger
    ).exec(true);

    let packageManifest:PackageManifest = new PackageManifest(sfpPackage.mdapiDir);
    sfpPackage._payload = await packageManifest.getManifest();
    sfpPackage._triggers = packageManifest.fetchTriggers();
    sfpPackage._isApexInPackage = packageManifest.isApexInPackage();
    sfpPackage._isProfilesInPackage = packageManifest.isProfilesInPackage();
    sfpPackage._packageType = ProjectConfig.getPackageType(
      ProjectConfig.getSFDXPackageManifest(projectDirectory),
      sfdx_package
    );

    let apexFetcher:ApexTypeFetcher = new ApexTypeFetcher(sfpPackage._mdapiDir);

    sfpPackage._apexClassesSortedByTypes = apexFetcher.getClassesClassifiedByType();
    sfpPackage._apexTestClassses = apexFetcher.getTestClasses();
    sfpPackage._metadataCount = MetadataCount.getMetadataCount(
      projectDirectory,
      sfpPackage._packageDescriptor.path
    );
    sfpPackage._apexClassWithOutTestClasses = apexFetcher.getClassesOnlyExcludingTestsAndInterfaces();


    for (const propertyFetcher of sfpPackage.propertyFetchers) {
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
      this._configFilePath
    );
    return workingDirectory;
  }


  public get isApexInPackage(): boolean {
    return this._isApexInPackage;
  }


  public get isProfilesInPackage(): boolean {
    return this._isProfilesInPackage;
  }
}
