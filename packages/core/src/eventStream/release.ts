import { PROCESSNAME,PATH,EVENTTYPE, ReleaseHookSchema, ReleaseProps, ReleaseDeployError, ReleaseTestResult, ReleaseTestCoverage } from './types';
import { HookService } from './hooks';
import SfpPackage from '../package/SfpPackage';
import fs from 'fs';

export class ReleaseStreamService {
    public static buildPackageInitialitation(
        pck: string,
        targetVersion: string,
        orgVersion: string,
        type: string
    ): void {
        ReleaseLoggerBuilder.getInstance().buildPackageInitialitation(pck, targetVersion, orgVersion, type);
    }

    public static buildProps(props: ReleaseProps): void {
        ReleaseLoggerBuilder.getInstance().buildProps(props);
    }

    public static buildStatus(message: string): void {
        ReleaseLoggerBuilder.getInstance().buildCommandError(message);
    }

    public static buildCommandError(message: string): void {
        ReleaseLoggerBuilder.getInstance().buildCommandError(message);
    }

    public static sendPackageError(pck: string, message: string): void {
        const file = ReleaseLoggerBuilder.getInstance().buildPackageError(pck, message).build();
        HookService.getInstance().logEvent(file.payload.events[pck]);
        //EventService.getInstance().logEvent(file.payload.events[pck]);
    }

    public static sendPackageSuccess(sfpPackage: SfpPackage): void {
        const file = ReleaseLoggerBuilder.getInstance().buildPackageCompleted(sfpPackage).build();
        //EventService.getInstance().logEvent(file.payload.events[sfpPackage.packageName]);
       HookService.getInstance().logEvent(file.payload.events[sfpPackage.packageName]);

    }

    public static buildDeployErrorsMsg(
        metadataType: string,
        apiName: string,
        problemType: string,
        problem: string
    ): void {
        ReleaseLoggerBuilder.getInstance().buildDeployErrorsMsg({
            metadataType: metadataType,
            apiName: apiName,
            problemType: problemType,
            problem: problem,
        });
    }

    public static buildDeployErrorsPkg(pck: string): void {
        ReleaseLoggerBuilder.getInstance().buildDeployErrorsPkg(pck);
    }

    public static buildStatusProgress(sfpPackage: SfpPackage): void {
        ReleaseLoggerBuilder.getInstance().buildStatusProgress(sfpPackage);
    }

    public static buildTestResult(name: string, outcome: string, message: string, runtime: number): void {
        ReleaseLoggerBuilder.getInstance().buildTestResult({name: name, outcome: outcome, message: message || 'N/A', runtime: runtime});
    }

    public static buildTestCoverage(cls: string, coverage: number): void {
        ReleaseLoggerBuilder.getInstance().buildTestCoverage({class: cls, coverage: coverage});
    }
    
    public static buildTestSummary(key: string, message: string | number): void {
        ReleaseLoggerBuilder.getInstance().buildTestSummary(key, message);
    }

    public static buildStatistik(elapsedTime: number, failed: number, success: number, scheduled: number): void {
        ReleaseLoggerBuilder.getInstance().buildStatistik(elapsedTime,failed,success, scheduled);
    }

    public static buildOrgInfo(orgInfo: string, devHubAlias: string): void {
        ReleaseLoggerBuilder.getInstance().buildOrgInfo(orgInfo, devHubAlias);
    }

    public static buildJobandBranchId(jobId: string, branch: string): void {
        ReleaseLoggerBuilder.getInstance().buildJobandBranchId(jobId,branch);
    }

    public static writeArtifatcs(): void {
        const file = ReleaseLoggerBuilder.getInstance().build();
        if (!fs.existsSync(PATH.DEFAULT)) {
            fs.mkdirSync(PATH.DEFAULT);
        }
        if (!fs.existsSync(PATH.RELEASE)) {
            // File doesn't exist, create it
            fs.writeFileSync(PATH.RELEASE, JSON.stringify(file, null, 4), 'utf-8');
        }
    }
}


class ReleaseLoggerBuilder {
    private file: ReleaseHookSchema;
    private static instance: ReleaseLoggerBuilder;

    private constructor() {
        this.file = {
            payload: {
                processName: PROCESSNAME.VALIDATE,
                scheduled: 0,
                success: 0,
                failed: 0,
                elapsedTime: 0,
                status: 'inprogress',
                message: '',
                releaseConfig: [],
                instanceUrl: '',
                events: {},
            },
            eventType: 'sfpowerscripts.release',
            jobId: '',
            devHubAlias: '',
            branch: '',
        };
    }

    public static getInstance(): ReleaseLoggerBuilder {
        if (!ReleaseLoggerBuilder.instance) {
            ReleaseLoggerBuilder.instance = new ReleaseLoggerBuilder();
        }

        return ReleaseLoggerBuilder.instance;
    }

    buildPackageInitialitation(
        pck: string,
        targetVersion: string,
        orgVersion: string,
        type: string
    ): ReleaseLoggerBuilder {
        this.file.payload.events[pck] = {
            event: 'sfpowerscripts.release.progress',
            context: {
                command: 'sfpowerscript:orchestrator:release',
                instanceUrl: this.file.payload.instanceUrl,
                timestamp: new Date(),
                jobId: this.file.jobId,
                eventId: `${this.file.jobId}_${Date.now().toString()}`,
                eventType: EVENTTYPE.RELEASE,
                branch: this.file.branch,
                commitId: '',
                devHubAlias: this.file.devHubAlias,
            },
            metadata: {
                package: pck,
                message: [],
                elapsedTime: 0,
                reasonToBuild: '',
                type: type,
                targetVersion: targetVersion,
                orgVersion: orgVersion,
                versionId: '',
                packageCoverage: 0,
                coverageCheckPassed: false,
                metadataCount: 0,
                apexInPackage: false,
                profilesInPackage: false,
                permissionSetGroupInPackage: false,
                isPayLoadContainTypesSupportedByProfiles: false,
                isPickListsFound: false,
                isDependencyValidated: false,
                creationDetails: {},
                sourceVersion: '',
                deployErrors: [],
                testResults: [],
                testCoverages: [],
                testSummary: {},
            },
            orgId: '',
        };
        HookService.getInstance().logEvent(this.file.payload.events[pck]);
        return this;
    }

    buildProps(props: ReleaseProps): ReleaseLoggerBuilder {
        this.file.payload.releaseProps = props;
        return this;
    }

    buildOrgInfo(orgInfo: string, devHubAlias: string): ReleaseLoggerBuilder {
        this.file.payload.instanceUrl = orgInfo;
        this.file.devHubAlias = devHubAlias;
        return this;
    }

    buildJobandBranchId(jobId: string, branch: string): ReleaseLoggerBuilder {
        this.file.jobId = jobId;
        this.file.branch = branch;
        return this;
    }

    buildPackageError(pck: string, message: string): ReleaseLoggerBuilder {
        this.file.payload.events[pck].event = 'sfpowerscripts.release.failed';
        this.file.payload.events[pck].context.timestamp = new Date();
        if (message) {
            this.file.payload.events[pck].metadata.message.push(message);
        }
        return this;
    }

    buildPackageCompleted(sfpPackage: SfpPackage): ReleaseLoggerBuilder {
        this.file.payload.events[sfpPackage.packageName].event = 'sfpowerscripts.release.success';
        this.file.payload.events[sfpPackage.packageName].context.timestamp = new Date();
        this.file.payload.events[sfpPackage.packageName].metadata.apexInPackage = sfpPackage.isApexFound;
        this.file.payload.events[sfpPackage.packageName].metadata.profilesInPackage = sfpPackage.isProfilesFound;
        this.file.payload.events[sfpPackage.packageName].metadata.metadataCount = sfpPackage.metadataCount;
        this.file.payload.events[sfpPackage.packageName].metadata.sourceVersion = sfpPackage.sourceVersion;
        this.file.payload.events[sfpPackage.packageName].metadata.packageCoverage = sfpPackage.test_coverage;
        this.file.payload.events[sfpPackage.packageName].metadata.coverageCheckPassed = sfpPackage.has_passed_coverage_check;
        this.file.payload.events[sfpPackage.packageName].metadata.versionId = sfpPackage.package_version_id;
        this.file.payload.events[sfpPackage.packageName].metadata.permissionSetGroupInPackage = sfpPackage.isPermissionSetGroupFound;
        this.file.payload.events[sfpPackage.packageName].metadata.isPayLoadContainTypesSupportedByProfiles = sfpPackage.isPayLoadContainTypesSupportedByProfiles;
        this.file.payload.events[sfpPackage.packageName].metadata.isPickListsFound = sfpPackage.isPickListsFound;
        this.file.payload.events[sfpPackage.packageName].metadata.isDependencyValidated = sfpPackage.isDependencyValidated;
        this.file.payload.events[sfpPackage.packageName].metadata.creationDetails = sfpPackage.creation_details;
        return this;
    }

    buildDeployErrorsMsg(deployError: ReleaseDeployError): ReleaseLoggerBuilder {
        Object.values(this.file.payload.events).forEach((value) => {
            if (value.event === 'sfpowerscripts.release.awaiting' || value.event === 'sfpowerscripts.release.failed') {
                value.metadata.deployErrors.push(deployError);
            }
        });
        return this;
    }

    buildDeployErrorsPkg(pck: string): ReleaseLoggerBuilder {
        Object.values(this.file.payload.events).forEach((value) => {
            if (value.event === 'sfpowerscripts.release.awaiting' || value.event === 'sfpowerscripts.release.progress' || value.event === 'sfpowerscripts.release.failed') {
                for (const err of value.metadata.deployErrors) {
                    err.package = pck;
                }
            }
        });
        return this;
    }

    buildTestResult(testResult: ReleaseTestResult): ReleaseLoggerBuilder {
        Object.values(this.file.payload.events).forEach((value) => {
            if (value.event === 'sfpowerscripts.release.progress') {
                value.metadata.testResults.push(testResult);
            }
        });
        return this;
    }

    buildTestCoverage(testCoverage: ReleaseTestCoverage): ReleaseLoggerBuilder {
        Object.values(this.file.payload.events).forEach((value) => {
            if (value.event === 'sfpowerscripts.release.progress') {
                value.metadata.testCoverages.push(testCoverage);
            }
        });
        return this;
    }

    buildTestSummary(key: string, message: string | number): ReleaseLoggerBuilder {
        Object.values(this.file.payload.events).forEach((value) => {
            if (value.event === 'sfpowerscripts.release.progress') {
                value.metadata.testSummary[key] = message;
            }
        });
        return this;
    }

    buildStatistik(elapsedTime: number, failed: number, success: number, scheduled: number): ReleaseLoggerBuilder {
        this.file.payload.elapsedTime = elapsedTime;
        this.file.payload.status = this.file.payload.status === 'inprogress' ? 'success' : 'failed';
        this.file.payload.failed = failed;
        this.file.payload.success = success;
        this.file.payload.scheduled = scheduled;
        return this;
    }

    buildStatusProgress(sfpPackage: SfpPackage): ReleaseLoggerBuilder {
        this.file.payload.events[sfpPackage.packageName].event = 'sfpowerscripts.release.progress';
        this.file.payload.events[sfpPackage.packageName].metadata.apexInPackage = sfpPackage.isApexFound;
        this.file.payload.events[sfpPackage.packageName].metadata.profilesInPackage = sfpPackage.isProfilesFound;
        this.file.payload.events[sfpPackage.packageName].metadata.metadataCount = sfpPackage.metadataCount;
        this.file.payload.events[sfpPackage.packageName].metadata.sourceVersion = sfpPackage.sourceVersion;
        this.file.payload.events[sfpPackage.packageName].metadata.packageCoverage = sfpPackage.test_coverage;
        this.file.payload.events[sfpPackage.packageName].metadata.coverageCheckPassed = sfpPackage.has_passed_coverage_check;
        this.file.payload.events[sfpPackage.packageName].metadata.versionId = sfpPackage.package_version_id;
        this.file.payload.events[sfpPackage.packageName].metadata.permissionSetGroupInPackage = sfpPackage.isPermissionSetGroupFound;
        this.file.payload.events[sfpPackage.packageName].metadata.isPayLoadContainTypesSupportedByProfiles = sfpPackage.isPayLoadContainTypesSupportedByProfiles;
        this.file.payload.events[sfpPackage.packageName].metadata.isPickListsFound = sfpPackage.isPickListsFound;
        this.file.payload.events[sfpPackage.packageName].metadata.isDependencyValidated = sfpPackage.isDependencyValidated;
        this.file.payload.events[sfpPackage.packageName].metadata.creationDetails = sfpPackage.creation_details;
        return this;
    }

    buildCommandError(message: string): ReleaseLoggerBuilder {
        this.file.payload.status = 'failed';
        this.file.payload.message = message;
        return this;
    }

    build(): ReleaseHookSchema {
        return this.file;
    }
}
