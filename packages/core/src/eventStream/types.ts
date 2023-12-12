import { Org } from "@salesforce/core";
// default types for file logger

export enum PROCESSNAME {
    PREPARE = "prepare",
    BUILD = "build",
    VALIDATE = "validate",
    RELEASE = "release",
}

export enum PATH {
    DEFAULT = ".sfpowerscripts",
    PREPARE = ".sfpowerscripts/eventStreamPrepare.json",
    BUILD = ".sfpowerscripts/eventStreamBuild.json",
    VALIDATE = ".sfpowerscripts/eventStreamValidate.json",
    RELEASE = ".sfpowerscripts/eventStreamRelease.json"
}

export enum EVENTTYPE {
    BUILD = "sfpowerscripts.build",
    RELEASE = "sfpowerscripts.release",
    VALIDATE = "sfpowerscripts.validate",
    PREPARE = "sfpowerscripts.prepare"
}


export interface Context {
    command: string;
    eventId: string;
    jobId: string;
    instanceUrl: string;
    timestamp: Date;
    commitId: string;
    branch: string;
    devHubAlias: string;
    eventType: string;
 }

// types for file logger prepare
export interface PrepareHookSchema {
    eventType: string;
    eventId: string;
    payload: PrepareFile;
}
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
    events: OrgDetails[];
}

export interface OrgDetails {
    event: 'sfpowerscripts.prepare.success' | 'sfpowerscripts.prepare.failed';
    context: Context;
    metadata: OrgInfo;
    orgId: string;
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

export interface BuildHookSchema {
    eventType: string;
    jobId: string;
    devhubAlias: string;
    commitId: string;
    payload: BuildFile;
}

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
    instanceUrl: string;
    events: BuildPackage;
}

export interface BuildPackage {
    [key: string]: BuildPackageDetails
}

export interface BuildPackageDetails {
    event: 'sfpowerscripts.build.success' | 'sfpowerscripts.build.failed' |  'sfpowerscripts.build.progress' | 'sfpowerscripts.build.awaiting';
    context: Context;
    metadata: BuildPackageMetadata;
}

export interface BuildPackageDependencies {
    order: number;
    pck: string;
    version: string;
}


export interface BuildPackageMetadata {
    package: string;
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

export interface ValidateHookSchema {
    eventType: string;
    eventId: string;
    payload: ValidateFile;
}

export interface ValidateFile {
    processName: string;
    scheduled: number;
    success: number;
    failed: number;
    elapsedTime: number;
    status: 'success' | 'failed' | 'inprogress';
    message: string;
    validateProps?: ValidateProps;
    releaseConfig?: string[];
    events: ValidatePackage;
}

export interface ValidatePackage {
    [key: string]: ValidatePackageDetails
}

export interface ValidatePackageDetails {
    event: 'sfpowerscripts.validate.success' | 'sfpowerscripts.validate.failed' |  'sfpowerscripts.validate.awaiting' | 'sfpowerscripts.validate.progress';
    context: Context;
    metadata: ValidatePackageMetadata;
    orgId: string;
}

export interface ValidatePackageMetadata {
    package: string;
    message: string[];
    elapsedTime: number;
    reasonToBuild: string;
    type: string;
    targetVersion: string;
    orgVersion: string;
    versionId: string;
    packageCoverage: number;
    coverageCheckPassed: boolean;
    metadataCount: number;
    apexInPackage: boolean;
    profilesInPackage: boolean;
    permissionSetGroupInPackage: boolean;
    isPayLoadContainTypesSupportedByProfiles: boolean;
    isPickListsFound: boolean;
    isDependencyValidated: boolean;
    creationDetails: {[key: string]: number};
    sourceVersion?: string;
    deployErrors: ValidateDeployError[];
    testResults: ValidateTestResult[];
    testCoverages: ValidateTestCoverage[];
    testSummary: ValidateTestSummary;
}

export interface ValidateTestResult {
    name: string;
    outcome: string;
    message: string;
    runtime: number;
}

export interface ValidateTestCoverage {
    class: string;
    coverage: number;
}

export interface ValidateTestSummary {
    [key: string]: string | number;
}

export interface ValidateDeployError {
    package?: string;
    metadataType: string;
    apiName: string;
    problemType: string;
    problem: string;
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

// types for file logger release

export interface ReleaseHookSchema {
    eventType: string;
    jobId: string;
    devHubAlias: string;
    branch: string;
    payload: ReleaseFile;
}

export interface ReleaseFile {
    processName: string;
    scheduled: number;
    success: number;
    failed: number;
    elapsedTime: number;
    status: 'success' | 'failed' | 'inprogress';
    message: string;
    releaseProps?: ReleaseProps;
    releaseConfig?: string[];
    instanceUrl: string;
    events: ReleasePackage;
}

export interface ReleasePackage {
    [key: string]: ReleasePackageDetails
}

export interface ReleasePackageDetails {
    event: 'sfpowerscripts.release.success' | 'sfpowerscripts.release.failed' |  'sfpowerscripts.release.awaiting' | 'sfpowerscripts.release.progress';
    context: Context;
    metadata: ReleasePackageMetadata;
    orgId: string;
}

export interface ReleasePackageMetadata {
    package: string;
    message: string[];
    elapsedTime: number;
    reasonToBuild: string;
    type: string;
    targetVersion: string;
    orgVersion: string;
    versionId: string;
    packageCoverage: number;
    coverageCheckPassed: boolean;
    metadataCount: number;
    apexInPackage: boolean;
    profilesInPackage: boolean;
    permissionSetGroupInPackage: boolean;
    isPayLoadContainTypesSupportedByProfiles: boolean;
    isPickListsFound: boolean;
    isDependencyValidated: boolean;
    creationDetails: {[key: string]: number};
    sourceVersion?: string;
    deployErrors: ValidateDeployError[];
    testResults: ValidateTestResult[];
    testCoverages: ValidateTestCoverage[];
    testSummary: ValidateTestSummary;
}

export interface ReleaseTestResult {
    name: string;
    outcome: string;
    message: string;
    runtime: number;
}

export interface ReleaseTestCoverage {
    class: string;
    coverage: number;
}

export interface ReleaseTestSummary {
    [key: string]: string | number;
}

export interface ReleaseDeployError {
    package?: string;
    metadataType: string;
    apiName: string;
    problemType: string;
    problem: string;
}


export interface ReleaseProps {
    releaseDefinitions: ReleaseDefinitionSchema[];
    targetOrg: string;
    fetchArtifactScript: string;
    isNpm: boolean;
    scope: string;
    npmrcPath: string;
    logsGroupSymbol: string[];
    tags: any;
    isDryRun: boolean;
    waitTime: number;
    keys: string;
    isGenerateChangelog: boolean;
    devhubUserName: string;
    branch: string;
    directory: string;
}

export interface SfPowerscriptsEvent__c {
    Name: string;
    Command__c: string;
    EventId__c: string;
    JobId__c: string;
    Branch__c: string;
    Commit__c: string;
    InstanceUrl__c: string;
    JobTimestamp__c: Date;
    EventName__c: string;
    Package__c: string;
    ErrorMessage__c: string;
}

export default interface ReleaseDefinitionSchema {
    release: string;
    skipIfAlreadyInstalled: boolean;
    skipArtifactUpdate:boolean;
    baselineOrg?: string;
    artifacts: {
        [p: string]: string;
    };
    packageDependencies?: {
        [p: string]: string;
    };
    promotePackagesBeforeDeploymentToOrg?: string;
    changelog?: {
        repoUrl?: string;
        workItemFilter?:string;
        workItemFilters?: string[];
        workItemUrl?: string;
        limit?: number;
        showAllArtifacts?: boolean;
    };
}

