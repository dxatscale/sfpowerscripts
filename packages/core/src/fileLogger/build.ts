import fs from 'fs';
import { PATH, PROCESSNAME, BuildFile, BuildPackage, BuildPackageDetails, BuildPackageDependencies } from './types';
import SfpPackage from "../package/SfpPackage";

export class FileLoggerService {
    public static writePackageInitialitation(pck: string, reason: string, tag: string): void {
        PrepareFileBuilder.getInstance().buildPackageInitialitation(pck, reason, tag).build();
    }

    public static writePackageError(pck: string, message: string): void {
        PrepareFileBuilder.getInstance().buildPackageError(pck, message).build();
    }

    public static writePackageErrorList(pck: string): void {
        PrepareFileBuilder.getInstance().buildPackageErrorList(pck).build();
    }

    public static writePackageSuccessList(pck: string): void {
        PrepareFileBuilder.getInstance().buildPackageSuccessList(pck).build();
    }

    public static writePackageAwaitingList(pck: string[]): void {
        PrepareFileBuilder.getInstance().buildPackageAwaitingList(pck).build();
    }

    public static writePackageCurrentlyProcessedList(pck: string[]): void {
        PrepareFileBuilder.getInstance().buildPackageCurrentlyProcessedList(pck).build();
    }

    public static writePackageCompletedInfos(sfpPackage: SfpPackage): void {
        PrepareFileBuilder.getInstance().buildPackageCompletedInfos(sfpPackage).build();
    }
}

class PrepareFileBuilder {
    private file: BuildFile;
    private static instance: PrepareFileBuilder;

    private constructor() {
        this.file = {
            processName: PROCESSNAME.PREPARE,
            success: 0,
            failed: 0,
            status: 'inprogress',
            message: '',
            awaitingDependencies: [],
            currentlyProcessed: [],
            successfullyProcessed: [],
            failedToProcess: [],
            packagesToBuild: {},
        };
    }

    public static getInstance(): PrepareFileBuilder {
        if (!PrepareFileBuilder.instance) {
            PrepareFileBuilder.instance = new PrepareFileBuilder();
            // Create .sfpowerscripts folder if not exist
            if (!fs.existsSync(PATH.DEFAULT)) {
                fs.mkdirSync(PATH.DEFAULT);
            }
            if (!fs.existsSync(PATH.BUILD)) {
                // File doesn't exist, create it
                fs.writeFileSync(PATH.BUILD, JSON.stringify(PrepareFileBuilder.instance.file), 'utf-8');
            }
        }

        return PrepareFileBuilder.instance;
    }

    buildPackageInitialitation(pck: string, reason: string, tag: string): PrepareFileBuilder {
        this.file.packagesToBuild[pck] = {
            status: 'awaiting',
            message: '',
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

    buildPackageCompletedInfos(sfpPackage: SfpPackage): PrepareFileBuilder {
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

    buildPackageError(pck: string, message: string): PrepareFileBuilder {
        this.file.packagesToBuild[pck].status = 'failed';
        this.file.packagesToBuild[pck].message = message;
        return this;
    }

    buildPackageErrorList(pcks: string): PrepareFileBuilder {
        this.file.failedToProcess.push(pcks);
        return this;
    }

    buildPackageSuccessList(pcks: string): PrepareFileBuilder {
        this.file.successfullyProcessed.push(pcks);
        return this;
    }

    buildPackageAwaitingList(pcks: string[]): PrepareFileBuilder {
        this.file.awaitingDependencies = pcks;
        return this;
    }

    buildPackageCurrentlyProcessedList(pcks: string[]): PrepareFileBuilder {
        this.file.currentlyProcessed = pcks;
        return this;
    }

    build(): void {
        fs.writeFileSync(PATH.BUILD, JSON.stringify(this.file, null, 2), 'utf-8');
    }
}
