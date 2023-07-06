import { Org } from "@salesforce/core";
// default types for file logger
export enum PATH {
    DEFAULT = ".sfpowerscripts",
    PREPARE = ".sfpowerscripts/prepare.json",
    BUILD = ".sfpowerscripts/build.json",
    VALIDATE = ".sfpowerscripts/validate.json"
}

export enum PROCESSNAME {
    PREPARE = "prepare",
    BUILD = "build",
    VALIDATE = "validate"
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
    scheduled: number;
    success: number;
    failed: number;
    elapsedTime: number;
    status: 'success' | 'failed' | 'inprogress';
    message: string;
    buildProps?: BuildProps;
    releaseConfig: string[];
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
    message: string[];
    elapsedTime: number;
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
    packageDependencies: BuildPackageDependencies[];
}

export interface BuildPackageDependencies {
    order: number;
    pck: string;
    version: string;
}

export interface BuildProps {
	projectDirectory?: string;
	devhubAlias?: string;
	repourl?: string;
	waitTime: number;
	isQuickBuild: boolean;
	isDiffCheckEnabled: boolean;
	buildNumber: number;
	executorcount: number;
	isBuildAllAsSourcePackages: boolean;
	branch?: string;
	baseBranch?: string;
	includeOnlyPackages?: string[];
}

// types for file logger validate
export interface ValidateFile {
    processName: string;
    scheduled: number;
    success: number;
    failed: number;
    elapsedTime: number;
    status: 'success' | 'failed' | 'inprogress';
    message: string;
    validateProps?: ValidateProps;
}

export enum ValidateAgainst {
	PROVIDED_ORG = "PROVIDED_ORG",
	PRECREATED_POOL = "PRECREATED_POOL",
}
export enum ValidationMode {
	INDIVIDUAL = "individual",
	FAST_FEEDBACK = "fastfeedback",
	THOROUGH = "thorough",
	FASTFEEDBACK_LIMITED_BY_RELEASE_CONFIG = "ff-release-config",
	THOROUGH_LIMITED_BY_RELEASE_CONFIG = "thorough-release-config",
}

export interface ValidateProps {
	installExternalDependencies?: boolean;
	validateAgainst: ValidateAgainst;
	validationMode: ValidationMode;
	releaseConfigPath?: string;
	coverageThreshold: number;
	logsGroupSymbol: string[];
	targetOrg?: string;
	hubOrg?: Org;
	pools?: string[];
	shapeFile?: string;
	isDeleteScratchOrg?: boolean;
	keys?: string;
	baseBranch?: string;
	isImpactAnalysis?: boolean;
	isDependencyAnalysis?: boolean;
	diffcheck?: boolean;
	disableArtifactCommit?: boolean;
	orgInfo?: boolean;
	disableSourcePackageOverride?: boolean;
	disableParallelTestExecution?: boolean;
}
