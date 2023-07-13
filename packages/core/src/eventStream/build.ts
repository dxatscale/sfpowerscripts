import fs from 'fs';
import { PATH, PROCESSNAME, BuildFile, BuildProps, BuildPackageDetails, BuildPackageDependencies } from './types';
import SfpPackage from '../package/SfpPackage';
import { EventService } from './event';
import { HookService } from './hooks';

export class BuildStreamService {
    public static buildPackageInitialitation(pck: string, reason: string, tag: string): void {
        BuildLoggerBuilder.getInstance().buildPackageInitialitation(pck, reason, tag);
    }

    public static sendPackageError(sfpPackage: SfpPackage, message: string): void {
        const file = BuildLoggerBuilder.getInstance().buildPackageError(sfpPackage, message).build();
        EventService.getInstance().logEvent(file.packagesToBuild[sfpPackage.package_name]);
    }

    public static buildPackageErrorList(pck: string): void {
        BuildLoggerBuilder.getInstance().buildPackageErrorList(pck);
    }

    public static buildPackageSuccessList(pck: string): void {
        BuildLoggerBuilder.getInstance().buildPackageSuccessList(pck);
    }

    public static buildPackageAwaitingList(pck: string[]): void {
        BuildLoggerBuilder.getInstance().buildPackageAwaitingList(pck);
    }

    public static buildPackageCurrentlyProcessedList(pck: string[]): void {
        BuildLoggerBuilder.getInstance().buildPackageCurrentlyProcessedList(pck);
    }

    public static sendPackageCompletedInfos(sfpPackage: SfpPackage): void {
        const file = BuildLoggerBuilder.getInstance().buildPackageCompletedInfos(sfpPackage).build();
        EventService.getInstance().logEvent(file.packagesToBuild[sfpPackage.package_name]);
    }

    public static buildPackageDependencies(pck: string, dependencies: BuildPackageDependencies): void {
        BuildLoggerBuilder.getInstance().buildPackageDependencies(pck, dependencies);
    }

    public static buildProps(props: BuildProps): void {
        BuildLoggerBuilder.getInstance().buildProps(props);
    }

    public static buildStatus(status: 'success' | 'failed' | 'inprogress', message: string): void {
        BuildLoggerBuilder.getInstance().buildStatus(status, message);
    }

    public static sendStatistics(scheduled: number, success: number, failed: number, elapsedTime: number): void {
        const file = BuildLoggerBuilder.getInstance().buildStatistics(scheduled, success, failed, elapsedTime).build();
        HookService.getInstance().logEvent(file);
    }

    public static buildReleaseConfig(pcks: string[]): void {
        BuildLoggerBuilder.getInstance().buildReleaseConfig(pcks);
    }

    public static buildPackageStatus(pck: string, status: 'success' | 'inprogress', elapsedTime?: number): void {
        BuildLoggerBuilder.getInstance().buildPackageStatus(pck, status, elapsedTime);
    }

    public static closeServer(): void {
        console.log('Closing server')
        EventService.getInstance().closeServer();
    }
}

class BuildLoggerBuilder {
    private file: BuildFile;
    private static instance: BuildLoggerBuilder;

    private constructor() {
        this.file = {
            processName: PROCESSNAME.BUILD,
            scheduled: 0,
            success: 0,
            failed: 0,
            elapsedTime: 0,
            status: 'inprogress',
            message: '',
            releaseConfig: [],
            awaitingDependencies: [],
            currentlyProcessed: [],
            successfullyProcessed: [],
            failedToProcess: [],
            packagesToBuild: {},
        };
    }

    public static getInstance(): BuildLoggerBuilder {
        if (!BuildLoggerBuilder.instance) {
            BuildLoggerBuilder.instance = new BuildLoggerBuilder();
            // Create .sfpowerscripts folder if not exist
            if (!fs.existsSync(PATH.DEFAULT)) {
                fs.mkdirSync(PATH.DEFAULT);
            }
            if (!fs.existsSync(PATH.BUILD)) {
                // File doesn't exist, create it
                fs.writeFileSync(PATH.BUILD, JSON.stringify(BuildLoggerBuilder.instance.file), 'utf-8');
            }
        }

        return BuildLoggerBuilder.instance;
    }

    buildPackageInitialitation(pck: string, reason: string, tag: string): BuildLoggerBuilder {
        this.file.packagesToBuild[pck] = {
            event: 'packageCreationAwaiting',
            context: { command: 'build', gitref: '', gitsha: '', run_id: '', timestamp: new Date() },
            metadata: {
                package: pck,
                message: [],
                elapsedTime: 0,
                reasonToBuild: reason,
                lastKnownTag: tag,
                type: '',
                versionNumber: '',
                versionId: '',
                testCoverage: 0,
                coverageCheckPassed: false,
                metadataCount: 0,
                apexInPackage: false,
                profilesInPackage: false,
                sourceVersion: '',
                packageDependencies: [],
            },
            orgId: '',
        };
        return this;
    }

    buildPackageCompletedInfos(sfpPackage: SfpPackage): BuildLoggerBuilder {
        this.file.packagesToBuild[sfpPackage.package_name].event = 'packageCreationSuccess';
        this.file.packagesToBuild[sfpPackage.package_name].metadata.type = sfpPackage.package_type;
        this.file.packagesToBuild[sfpPackage.package_name].metadata.versionNumber = sfpPackage.package_version_number;
        this.file.packagesToBuild[sfpPackage.package_name].metadata.versionId = sfpPackage.package_version_id;
        this.file.packagesToBuild[sfpPackage.package_name].metadata.testCoverage = sfpPackage.test_coverage;
        this.file.packagesToBuild[sfpPackage.package_name].metadata.coverageCheckPassed =
            sfpPackage.has_passed_coverage_check;
        this.file.packagesToBuild[sfpPackage.package_name].metadata.metadataCount = sfpPackage.metadataCount;
        this.file.packagesToBuild[sfpPackage.package_name].metadata.apexInPackage = sfpPackage.isApexFound;
        this.file.packagesToBuild[sfpPackage.package_name].metadata.profilesInPackage = sfpPackage.isProfilesFound;
        this.file.packagesToBuild[sfpPackage.package_name].metadata.sourceVersion = sfpPackage.sourceVersion;
        this.file.packagesToBuild[sfpPackage.package_name].context.timestamp = new Date();
        return this;
    }

    buildPackageError(sfpPackage: SfpPackage, message: string): BuildLoggerBuilder {
        this.file.packagesToBuild[sfpPackage.package_name].event = 'packageCreationFailed';
        this.file.packagesToBuild[sfpPackage.package_name].metadata.type = sfpPackage.package_type;
        this.file.packagesToBuild[sfpPackage.package_name].context.timestamp = new Date();
        if (message) {
            this.file.packagesToBuild[sfpPackage.package_name].metadata.message.push(message);
        }
        return this;
    }

    buildPackageErrorList(pcks: string): BuildLoggerBuilder {
        this.file.failedToProcess.push(pcks);
        return this;
    }

    buildPackageSuccessList(pcks: string): BuildLoggerBuilder {
        this.file.successfullyProcessed.push(pcks);
        return this;
    }

    buildPackageAwaitingList(pcks: string[]): BuildLoggerBuilder {
        this.file.awaitingDependencies = pcks;
        return this;
    }

    buildPackageCurrentlyProcessedList(pcks: string[]): BuildLoggerBuilder {
        this.file.currentlyProcessed = pcks;
        return this;
    }

    buildPackageDependencies(pck: string, dependencies: BuildPackageDependencies): BuildLoggerBuilder {
        this.file.packagesToBuild[pck].metadata.packageDependencies.push(dependencies);
        return this;
    }

    buildProps(props: BuildProps): BuildLoggerBuilder {
        this.file.buildProps = { ...props };
        return this;
    }

    buildStatus(status: 'inprogress' | 'success' | 'failed', message: string): BuildLoggerBuilder {
        this.file.status = status;
        this.file.message = message;
        return this;
    }

    buildStatistics(scheduled: number, success: number, failed: number, elapsedTime: number): BuildLoggerBuilder {
        this.file.scheduled = success + failed;
        this.file.success = success;
        this.file.failed = failed;
        this.file.elapsedTime = elapsedTime;
        this.file.awaitingDependencies = [];
        // set status to success when scheduled = success
        if (this.file.scheduled > 1 && this.file.scheduled === this.file.success) {
            this.file.status = 'success';
        } else {
            this.file.status = 'failed';
        }
        return this;
    }

    buildReleaseConfig(pcks: string[]): BuildLoggerBuilder {
        this.file.releaseConfig = pcks;
        return this;
    }

    buildPackageStatus(pck: string, status: 'success' | 'inprogress', elapsedTime?: number): BuildLoggerBuilder {
        this.file.packagesToBuild[pck].event =
            status === 'success' ? 'packageCreationSuccess' : 'packageCreationInProgress';
        if (elapsedTime) {
            this.file.packagesToBuild[pck].metadata.elapsedTime = elapsedTime;
        }
        return this;
    }

    build(): BuildFile {
        return this.file;
    }
}
