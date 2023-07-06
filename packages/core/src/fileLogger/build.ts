import fs from 'fs';
import { PATH, PROCESSNAME, BuildFile, BuildProps, BuildPackageDetails, BuildPackageDependencies } from './types';
import SfpPackage from "../package/SfpPackage";

export class FileLoggerService {
    public static writePackageInitialitation(pck: string, reason: string, tag: string): void {
        BuildFileBuilder.getInstance().buildPackageInitialitation(pck, reason, tag).build();
    }

    public static writePackageError(pck: string, message: string): void {
        BuildFileBuilder.getInstance().buildPackageError(pck, message).build();
    }

    public static writePackageErrorList(pck: string): void {
        BuildFileBuilder.getInstance().buildPackageErrorList(pck).build();
    }

    public static writePackageSuccessList(pck: string): void {
        BuildFileBuilder.getInstance().buildPackageSuccessList(pck).build();
    }

    public static writePackageAwaitingList(pck: string[]): void {
        BuildFileBuilder.getInstance().buildPackageAwaitingList(pck).build();
    }

    public static writePackageCurrentlyProcessedList(pck: string[]): void {
        BuildFileBuilder.getInstance().buildPackageCurrentlyProcessedList(pck).build();
    }

    public static writePackageCompletedInfos(sfpPackage: SfpPackage): void {
        BuildFileBuilder.getInstance().buildPackageCompletedInfos(sfpPackage).build();
    }

    public static writePackageDependencies(pck: string, dependencies: BuildPackageDependencies): void {
        BuildFileBuilder.getInstance().buildPackageDependencies(pck, dependencies).build();
    }

    public static writeProps(props: BuildProps): void {
        BuildFileBuilder.getInstance().buildProps(props).build();
    }

    public static writeStatus(status: 'success' | 'failed' | 'inprogress', message: string): void {
        BuildFileBuilder.getInstance().buildStatus(status, message).build();
    }

    public static writeStatistics(scheduled: number, success: number, failed: number, elapsedTime: number): void {
        BuildFileBuilder.getInstance().buildStatistics(scheduled,success, failed,elapsedTime).build();
    }

    public static writeReleaseConfig(pcks: string[]): void {
        BuildFileBuilder.getInstance().buildReleaseConfig(pcks).build();
    }

   public static writePackageStatus(pck: string, status: 'success' | 'inprogress',elapsedTime?: number): void {
       BuildFileBuilder.getInstance().buildPackageStatus(pck, status, elapsedTime).build();
   }
}

class BuildFileBuilder {
    private file: BuildFile;
    private static instance: BuildFileBuilder;

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

    public static getInstance(): BuildFileBuilder {
        if (!BuildFileBuilder.instance) {
            BuildFileBuilder.instance = new BuildFileBuilder();
            // Create .sfpowerscripts folder if not exist
            if (!fs.existsSync(PATH.DEFAULT)) {
                fs.mkdirSync(PATH.DEFAULT);
            }
            if (!fs.existsSync(PATH.BUILD)) {
                // File doesn't exist, create it
                fs.writeFileSync(PATH.BUILD, JSON.stringify(BuildFileBuilder.instance.file), 'utf-8');
            }
        }

        return BuildFileBuilder.instance;
    }

    buildPackageInitialitation(pck: string, reason: string, tag: string): BuildFileBuilder {
        this.file.packagesToBuild[pck] = {
            status: 'awaiting',
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
        };
        return this;
    }

    buildPackageCompletedInfos(sfpPackage: SfpPackage): BuildFileBuilder {
        this.file.packagesToBuild[sfpPackage.package_name].type = sfpPackage.package_type;
        this.file.packagesToBuild[sfpPackage.package_name].versionNumber = sfpPackage.package_version_number;
        this.file.packagesToBuild[sfpPackage.package_name].versionId = sfpPackage.package_version_id;
        this.file.packagesToBuild[sfpPackage.package_name].testCoverage = sfpPackage.test_coverage;
        this.file.packagesToBuild[sfpPackage.package_name].coverageCheckPassed = sfpPackage.has_passed_coverage_check;
        this.file.packagesToBuild[sfpPackage.package_name].metadataCount = sfpPackage.metadataCount;
        this.file.packagesToBuild[sfpPackage.package_name].apexInPackage = sfpPackage.isApexFound;
        this.file.packagesToBuild[sfpPackage.package_name].profilesInPackage = sfpPackage.isProfilesFound;
        this.file.packagesToBuild[sfpPackage.package_name].sourceVersion = sfpPackage.sourceVersion;
        return this;
    }

    buildPackageError(pck: string, message: string): BuildFileBuilder {
        this.file.packagesToBuild[pck].status = 'failed';
        if(message){
        this.file.packagesToBuild[pck].message.push(message);
        }
        return this;
    }

    buildPackageErrorList(pcks: string): BuildFileBuilder {
        this.file.failedToProcess.push(pcks);
        return this;
    }

    buildPackageSuccessList(pcks: string): BuildFileBuilder {
        this.file.successfullyProcessed.push(pcks);
        return this;
    }

    buildPackageAwaitingList(pcks: string[]): BuildFileBuilder {
        this.file.awaitingDependencies = pcks;
        return this;
    }

    buildPackageCurrentlyProcessedList(pcks: string[]): BuildFileBuilder {
        this.file.currentlyProcessed = pcks;
        return this;
    }

    buildPackageDependencies(pck: string, dependencies: BuildPackageDependencies): BuildFileBuilder {
        this.file.packagesToBuild[pck].packageDependencies.push(dependencies);
        return this;
    }

    buildProps(props: BuildProps): BuildFileBuilder {
        this.file.buildProps = {...props};
        return this;
    }

    buildStatus(status: "inprogress" | "success" | "failed", message: string): BuildFileBuilder {
        this.file.status = status;
        this.file.message = message;
        return this;
    }

    buildStatistics(scheduled: number, success: number, failed: number, elapsedTime: number): BuildFileBuilder {
        this.file.scheduled = success + failed;
        this.file.success = success;
        this.file.failed = failed;
        this.file.elapsedTime = elapsedTime;
        // set status to success when scheduled = success
        if ( this.file.scheduled > 1 && this.file.scheduled === this.file.success) {
          this.file.status = 'success';
        } else {
          this.file.status = 'failed';
        }
        return this;
    }

    buildReleaseConfig(pcks: string[]): BuildFileBuilder {
        this.file.releaseConfig = pcks;
        return this;
    }

    buildPackageStatus(pck: string, status: 'success' | 'inprogress', elapsedTime?: number): BuildFileBuilder {
        this.file.packagesToBuild[pck].status = status;
        if(elapsedTime){
            this.file.packagesToBuild[pck].elapsedTime = elapsedTime;
        }
        return this;
    }

    build(): void {
        fs.writeFileSync(PATH.BUILD, JSON.stringify(this.file, null, 2), 'utf-8');
    }
}
