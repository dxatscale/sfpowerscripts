import { PROCESSNAME, ValidateHookSchema, ValidateProps, ValidateDeployError, ValidateTestResult, ValidateTestCoverage, ValidateTestSummary } from './types';
import { EventService } from './event';
import { HookService } from './hooks';
import SfpPackage from '../package/SfpPackage';

export class ValidateStreamService {
    public static buildPackageInitialitation(
        pck: string,
        targetVersion: string,
        orgVersion: string,
        type: string
    ): void {
        ValidateLoggerBuilder.getInstance().buildPackageInitialitation(pck, targetVersion, orgVersion, type);
    }

    public static buildProps(props: ValidateProps): void {
        ValidateLoggerBuilder.getInstance().buildProps(props);
    }

    public static buildStatus(message: string): void {
        ValidateLoggerBuilder.getInstance().buildCommandError(message);
    }

    public static buildReleaseConfig(pcks: string[]): void {
        ValidateLoggerBuilder.getInstance().buildReleaseConfig(pcks);
    }

    public static buildCommandError(message: string): void {
        ValidateLoggerBuilder.getInstance().buildCommandError(message);
    }

    public static sendPackageError(pck: string, message: string): void {
        const file = ValidateLoggerBuilder.getInstance().buildPackageError(pck, message).build();
        EventService.getInstance().logEvent(file.payload.events[pck]);
    }

    public static sendPackageSuccess(sfpPackage: SfpPackage): void {
        const file = ValidateLoggerBuilder.getInstance().buildPackageCompleted(sfpPackage).build();
        EventService.getInstance().logEvent(file.payload.events[sfpPackage.packageName]);
    }

    public static buildDeployErrorsMsg(
        metadataType: string,
        apiName: string,
        problemType: string,
        problem: string
    ): void {
        ValidateLoggerBuilder.getInstance().buildDeployErrorsMsg({
            metadataType: metadataType,
            apiName: apiName,
            problemType: problemType,
            problem: problem,
        });
    }

    public static buildDeployErrorsPkg(pck: string): void {
        ValidateLoggerBuilder.getInstance().buildDeployErrorsPkg(pck);
    }

    public static buildStatusProgress(sfpPackage: SfpPackage): void {
        ValidateLoggerBuilder.getInstance().buildStatusProgress(sfpPackage);
    }

    public static buildTestResult(name: string, outcome: string, message: string, runtime: number): void {
        ValidateLoggerBuilder.getInstance().buildTestResult({name: name, outcome: outcome, message: message || 'N/A', runtime: runtime});
    }

    public static buildTestCoverage(cls: string, coverage: number): void {
        ValidateLoggerBuilder.getInstance().buildTestCoverage({class: cls, coverage: coverage});
    }
    
    public static buildTestSummary(key: string, message: string | number): void {
        ValidateLoggerBuilder.getInstance().buildTestSummary(key, message);
    }

    public static buildStatistik(elapsedTime: number, failed: number, success: number, scheduled: number): void {
        ValidateLoggerBuilder.getInstance().buildStatistik(elapsedTime,failed,success, scheduled);
    }

    public static startServer(): void {
        EventService.getInstance();
    }

    public static closeServer(): void {
        const file = ValidateLoggerBuilder.getInstance().build();
        HookService.getInstance().logEvent(file);
        EventService.getInstance().closeServer();
    }
}

class ValidateLoggerBuilder {
    private file: ValidateHookSchema;
    private static instance: ValidateLoggerBuilder;

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
                events: {},
            },
            eventType: 'sfpowerscripts.validate',
            eventId: process.env.EVENT_STREAM_WEBHOOK_EVENTID,
        };
    }

    public static getInstance(): ValidateLoggerBuilder {
        if (!ValidateLoggerBuilder.instance) {
            ValidateLoggerBuilder.instance = new ValidateLoggerBuilder();
        }

        return ValidateLoggerBuilder.instance;
    }

    buildPackageInitialitation(
        pck: string,
        targetVersion: string,
        orgVersion: string,
        type: string
    ): ValidateLoggerBuilder {
        this.file.payload.events[pck] = {
            event: 'sfpowerscripts.validate.awaiting',
            context: {
                command: 'sfpowerscript:orchestrator:validate',
                eventId: process.env.EVENT_STREAM_WEBHOOK_EVENTID,
                instanceUrl: '',
                timestamp: new Date(),
                jobId: '',
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
        return this;
    }

    buildProps(props: ValidateProps): ValidateLoggerBuilder {
        const { hubOrg, ...rest } = props;
        this.file.payload.validateProps = { ...rest };
        return this;
    }

    buildPackageError(pck: string, message: string): ValidateLoggerBuilder {
        this.file.payload.events[pck].event = 'sfpowerscripts.validate.failed';
        this.file.payload.events[pck].context.timestamp = new Date();
        if (message) {
            this.file.payload.events[pck].metadata.message.push(message);
        }
        return this;
    }

    buildPackageCompleted(sfpPackage: SfpPackage): ValidateLoggerBuilder {
        this.file.payload.events[sfpPackage.packageName].event = 'sfpowerscripts.validate.success';
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

    buildDeployErrorsMsg(deployError: ValidateDeployError): ValidateLoggerBuilder {
        Object.values(this.file.payload.events).forEach((value) => {
            if (value.event === 'sfpowerscripts.validate.awaiting') {
                value.metadata.deployErrors.push(deployError);
            }
        });
        return this;
    }

    buildDeployErrorsPkg(pck: string): ValidateLoggerBuilder {
        Object.values(this.file.payload.events).forEach((value) => {
            if (value.event === 'sfpowerscripts.validate.awaiting' || value.event === 'sfpowerscripts.validate.progress') {
                for (const err of value.metadata.deployErrors) {
                    err.package = pck;
                }
            }
        });
        return this;
    }

    buildTestResult(testResult: ValidateTestResult): ValidateLoggerBuilder {
        Object.values(this.file.payload.events).forEach((value) => {
            if (value.event === 'sfpowerscripts.validate.progress') {
                value.metadata.testResults.push(testResult);
            }
        });
        return this;
    }

    buildTestCoverage(testCoverage: ValidateTestCoverage): ValidateLoggerBuilder {
        Object.values(this.file.payload.events).forEach((value) => {
            if (value.event === 'sfpowerscripts.validate.progress') {
                value.metadata.testCoverages.push(testCoverage);
            }
        });
        return this;
    }

    buildTestSummary(key: string, message: string | number): ValidateLoggerBuilder {
        Object.values(this.file.payload.events).forEach((value) => {
            if (value.event === 'sfpowerscripts.validate.progress') {
                value.metadata.testSummary[key] = message;
            }
        });
        return this;
    }

    buildStatistik(elapsedTime: number, failed: number, success: number, scheduled: number): ValidateLoggerBuilder {
        this.file.payload.elapsedTime = elapsedTime;
        this.file.payload.status = this.file.payload.status === 'inprogress' ? 'success' : 'failed';
        this.file.payload.failed = failed;
        this.file.payload.success = success;
        this.file.payload.scheduled = scheduled;
        return this;
    }

    buildStatusProgress(sfpPackage: SfpPackage): ValidateLoggerBuilder {
        this.file.payload.events[sfpPackage.package_name].event = 'sfpowerscripts.validate.progress';
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

    buildCommandError(message: string): ValidateLoggerBuilder {
        this.file.payload.status = 'failed';
        this.file.payload.message = message;
        return this;
    }

    buildReleaseConfig(pcks: string[]): ValidateLoggerBuilder {
        this.file.payload.releaseConfig = pcks;
        return this;
    }

    build(): ValidateHookSchema {
        return this.file;
    }
}
