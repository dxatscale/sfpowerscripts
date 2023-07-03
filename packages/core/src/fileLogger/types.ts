// default types for file logger
export enum PATH {
    DEFAULT = ".sfpowerscripts",
    PREPARE = ".sfpowerscripts/prepare.json",
    BUILD = ".sfpowerscripts/build.json",
}

export enum PROCESSNAME {
    PREPARE = "prepare",
    BUILD = "build"
}

// types for file logger prepare
export interface PrepareFile {
    processName: string;
    success: number;
    failed: number;
    status: 'success' | 'failed' | 'inprogress';
    message: string;
    errorCode: string;
    poolDefinition: PoolDefinition;
    poolInfo: Poolinfo;
    externalDependencies: ExternalDependency[];
    releaseConfig?: string[];
}

export interface Poolinfo {
    activeOrgs: number;
    maxOrgs: number;
    prepareDuration: number;
    orgInfos: OrgInfo[];
}

export interface OrgInfo {
    alias: string;
    orgId: string;
    username: string;
    loginURL: string;
    elapsedTime: number;
    password: string;
    status?: 'success' | 'failed';
    message?: string;
}

export interface ExternalDependency {
    order: number;
    pck: string;
    version?: string;
    subscriberVersionId: string;
}

export interface PoolDefinition {
    tag: string;
    waitTime?: number;
    expiry?: number;
    maxAllocation: number;
    batchSize?: number;
    configFilePath?: string;
    releaseConfigFile?: string;
    succeedOnDeploymentErrors?: boolean;
    installAll?: boolean;
    enableVlocity?: boolean;
    enableSourceTracking?: boolean;
    relaxAllIPRanges?: boolean;
    ipRangesToBeRelaxed?: string[];
    retryOnFailure?: boolean;
    maxRetryCount?: number;
    snapshotPool?: string;
    postDeploymentScriptPath?: string;
    preDependencyInstallationScriptPath?: string;
    disableSourcePackageOverride?: boolean;
 }

// types for file logger build

export interface BuildFile {
    processName: string;
    success: number;
    failed: number;
    status: 'success' | 'failed' | 'inprogress';
    message: string;
    awaitingDependencies: string[];
    currentlyProcessed: string[];
    successfullyProcessed: string[];
    failedToProcess: string[];
    packagesToBuild: BuildPackage;
}

export interface BuildPackage {
    [key: string]: BuildPackageDetails
}

export interface BuildPackageDetails {
    status: 'success' | 'failed' | 'inprogress' | 'awaiting';
    message: string;
    reasonToBuild: string;
    lastKnownTag: string;
    type: string;
    versionNumber: string;
    versionId: string;
    testCoverage: number;
    coverageCheckPassed: boolean;
    metadataCount: number;
    apexInPackage: boolean;
    profilesInPackage: boolean;
    sourceVersion?: string;
    packageDependencies?: BuildPackageDependencies[];
}

export interface BuildPackageDependencies {
    order: number;
    pck: string;
    version: string;
}