import _ from 'lodash';
import { ApexSortedByType } from '../apex/parser/ApexTypeFetcher';

export type ApexClasses = Array<string>;

class PackageInfo {
    id?: string;
    package_name: string;
    package_version_number?: string;
    package_version_id?: string;
    package_type?: string;
    test_coverage?: number;
    has_passed_coverage_check?: boolean;
    repository_url?: string;
    sourceVersion?: string;
    branch?: string;
    apextestsuite?: string;
    isApexFound?: boolean;
    assignPermSetsPreDeployment?: string[];
    assignPermSetsPostDeployment?: string[];
    apexTestClassses?: string[];
    isPickListsFound?: boolean;
    isTriggerAllTests?: boolean;
    isProfilesFound?: boolean;
    isPermissionSetGroupFound?: boolean;
    isPromoted?: boolean;
    tag?: string;
    isDependencyValidated?: boolean;
    destructiveChanges?: any;
    destructiveChangesPath?: string;
    payload?: any;
    metadataCount?: number;
    sourceDir?: string;
    dependencies?: any;
    reconcileProfiles?: boolean;
    isPayLoadContainTypesSupportedByProfiles?: boolean;
    creation_details?: { creation_time?: number; timestamp?: number };
    deployments?: { target_org: string; sub_directory?: string; installation_time?: number; timestamp?: number }[];
    apiVersion?: string;
    postDeploymentScript?: string;
    preDeploymentScript?: string;
    apexClassWithOutTestClasses?: ApexClasses;
    triggers?: ApexClasses;
    configFilePath?: string;
    packageDescriptor?: any;
    commitSHAFrom?:string;
    commitSHATo?:string;
    packageDirectory?: string;
    apexClassesSortedByTypes?: ApexSortedByType;
    projectConfig?: any;
    changelogFilePath?: string;
}

export default class SfpPackage extends PackageInfo {
    public projectDirectory: string;
    public workingDirectory: string;
    public mdapiDir: string;
    public destructiveChangesPath: string;
    public resolvedPackageDirectory: string;

    public version: string = '5';

    //Just a few helpers to resolve api differene
    public get packageName(): string {
        return this.package_name;
    }

    public get versionNumber(): string {
        return this.package_version_number;
    }

    public set versionNumber(versionNumber:string)
    {
        this.package_version_number = versionNumber;
    }

    public get packageType(): string {
        return this.package_type.toLocaleLowerCase();
    }

    public set packageType(packageType: string) {
        this.package_type = packageType;
    }
    /**
     * Do not use this constructor directly, use SfPPackageBuilder
     * to build a package
     *
     */
    public constructor() {
        super();
    }

    toJSON(): PackageInfo {
        let castToPackageMetadata = _.cloneDeep(this);
        delete castToPackageMetadata.workingDirectory;
        delete castToPackageMetadata.mdapiDir;
        delete castToPackageMetadata.projectConfig;
        delete castToPackageMetadata.packageDescriptor;
        delete castToPackageMetadata.projectDirectory;
        delete castToPackageMetadata.resolvedPackageDirectory;
        delete castToPackageMetadata.isTriggerAllTests;
        return castToPackageMetadata;
    }
}


export enum PackageType {
    Unlocked = "unlocked",
    Source = "source",
    Data = "data",
    Diff = "diff"
}

export interface DiffPackageMetadata {


    sourceVersionFrom?: string;
    sourceVersionTo?: string;
    isProfilesFound?: boolean;
    apexTestClassses?: string[];
    isApexFound?: boolean;
    isPicklistFound?: boolean;
    isPermissionSetGroupFound?: boolean;
    isPermissionSetFound?: boolean;
    payload?: any;
    metadataCount?: number;
    profilesToReconcile?: number;
    destructiveChanges?: any;
    sourceDir?: string;
    invalidatedTestClasses?: ApexClasses;
    isPayLoadContainTypesSupportedByProfiles?:boolean;
}
export interface SfpPackageParams {
    overridePackageTypeWith?: string;
    branch?: string;
    packageVersionNumber?: string;
    repositoryUrl?: string;
    sourceVersion?: string;
    configFilePath?: string;
    pathToReplacementForceIgnore?: string;
    revisionFrom?: string;
    revisionTo?: string;
}
