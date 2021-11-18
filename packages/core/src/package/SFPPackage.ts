import ApexTypeFetcher, {
  ApexSortedByType,
} from "../apex/parser/ApexTypeFetcher";
import ProjectConfig from "../project/ProjectConfig";
import SourcePackageGenerator from "../generators/SourcePackageGenerator";
import ConvertSourceToMDAPIImpl from "../sfdxwrappers/ConvertSourceToMDAPIImpl";
import PackageManifest from "./PackageManifest";
import MetadataCount from "./MetadataCount";

import PropertyFetcher from "./propertyFetchers/PropertyFetcher";
import AssignPermissionSetFetcher from "./propertyFetchers/AssignPermissionSetFetcher";
import DestructiveManifestPathFetcher from "./propertyFetchers/DestructiveManifestPathFetcher";
import ReconcilePropertyFetcher from "./propertyFetchers/ReconcileProfilePropertyFetcher";
import { Logger } from "../logger/SFPLogger";

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
  private _isPermissionSetGroupInPackage:boolean;
  private _configFilePath: string;
  private _projectDirectory: string;
  private _apexClassesSortedByTypes: ApexSortedByType;
  private _workingDirectory: string;
  private _isProfileSupportedMetadataInPackage:boolean;


  private readonly _propertyFetchers: PropertyFetcher[] = [
    new AssignPermissionSetFetcher(),
    new DestructiveManifestPathFetcher(),
    new ReconcilePropertyFetcher(),
  ];

  public assignPermSetsPreDeployment?: string[];
  public assignPermSetsPostDeployment?: string[];
  public destructiveChangesPath: string;
  public destructiveChanges?: any;
  public reconcileProfiles: boolean;
  public postDeploymentScript: string;
  public preDeploymentScript: string;
  public version: string='3';

  private constructor(private _logger: Logger) {}

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

  public get apexClassesSortedByTypes(): ApexSortedByType {
    return this._apexClassesSortedByTypes;
  }

  public get triggers(): ApexClasses {
    return this._triggers;
  }

  public get workingDirectory(): string {
    return this._workingDirectory;
  }

  public get propertyFetchers(): PropertyFetcher[] {
    return this._propertyFetchers;
  }

  public static async buildPackageFromProjectConfig(
    packageLogger: Logger,
    projectDirectory: string,
    sfdx_package: string,
    configFilePath?: string,
    pathToReplacementForceIgnore?: string
  ) {
    let sfpPackage: SFPPackage = new SFPPackage(packageLogger);
    sfpPackage._package_name = sfdx_package;
    sfpPackage._packageDescriptor = ProjectConfig.getSFDXPackageDescriptor(
      projectDirectory,
      sfdx_package
    );

    sfpPackage._projectDirectory = projectDirectory;

    if (configFilePath == null)
      sfpPackage._configFilePath = "config/project-scratch-def.json";
    else sfpPackage._configFilePath = configFilePath;

    for (const propertyFetcher of sfpPackage.propertyFetchers) {
      await propertyFetcher.getSfpowerscriptsProperties(
        sfpPackage,
        packageLogger
      );
    }

    // Requires destructiveChangesPath which is set by the property fetcher
    sfpPackage._workingDirectory = SourcePackageGenerator.generateSourcePackageArtifact(
      sfpPackage._logger,
      sfpPackage._projectDirectory,
      sfpPackage._package_name,
      sfpPackage._packageDescriptor.path,
      sfpPackage.destructiveChangesPath,
      sfpPackage._configFilePath,
      pathToReplacementForceIgnore
    );

    sfpPackage._mdapiDir = await new ConvertSourceToMDAPIImpl(
      sfpPackage._workingDirectory,
      sfpPackage._packageDescriptor.path,
      packageLogger
    ).exec(true);

    const packageManifest: PackageManifest = await PackageManifest.create(
      sfpPackage.mdapiDir
    );
    sfpPackage._payload = packageManifest.manifestJson;
    sfpPackage._triggers = packageManifest.fetchTriggers();
    sfpPackage._isApexInPackage = packageManifest.isApexInPackage();
    sfpPackage._isProfilesInPackage = packageManifest.isProfilesInPackage();
    sfpPackage._isPermissionSetGroupInPackage = packageManifest.isPermissionSetGroupsFoundInPackage();
    sfpPackage._isProfileSupportedMetadataInPackage = packageManifest.isPayLoadContainTypesSupportedByProfiles();
    sfpPackage._packageType = ProjectConfig.getPackageType(
      ProjectConfig.getSFDXPackageManifest(sfpPackage._workingDirectory),
      sfdx_package
    );


    let apexFetcher: ApexTypeFetcher = new ApexTypeFetcher(
      sfpPackage._mdapiDir
    );

    sfpPackage._apexClassesSortedByTypes = apexFetcher.getClassesClassifiedByType();
    sfpPackage._apexTestClassses = apexFetcher.getTestClasses();
    sfpPackage._metadataCount = MetadataCount.getMetadataCount(
      sfpPackage._workingDirectory,
      sfpPackage._packageDescriptor.path
    );
    sfpPackage._apexClassWithOutTestClasses = apexFetcher.getClassesOnlyExcludingTestsAndInterfaces();


    return sfpPackage;
  }

  public get isApexInPackage(): boolean {
    return this._isApexInPackage;
  }

  public get isProfilesInPackage(): boolean {
    return this._isProfilesInPackage;
  }

  public get isPermissionSetGroupInPackage(): boolean {
    return this._isPermissionSetGroupInPackage;
  }
  public get isProfileSupportedMetadataInPackage():boolean {
    return this._isProfileSupportedMetadataInPackage;
  }


}
