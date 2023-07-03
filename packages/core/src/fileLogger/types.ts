export enum PATH {
    DEFAULT = ".sfpowerscripts",
    PREPARE = ".sfpowerscripts/prepare.json",
    BUILD = ".sfpowerscripts/build.json",
}

export enum PROCESSNAME {
    PREPARE = "prepare",
    BUILD = "build"
}

export interface PrepareFile {
    processName: string;
    success: number;
    failed: number;
    status: 'success' | 'failed' | 'inprogress';
    message: string;
    errorCode: string
    poolInfo: Poolinfo;
    externalDependencies: ExternalDependency[];
}

export interface Poolinfo {
    tag: string;
    activeOrgs: number;
    maxOrgs: number;
    allocatedOrgs: number;
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