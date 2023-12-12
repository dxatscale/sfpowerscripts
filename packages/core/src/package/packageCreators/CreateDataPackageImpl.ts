import SFPLogger, { LoggerLevel, Logger } from '@dxatscale/sfp-logger';
import path from 'path';
import FileSystem from '../../utils/FileSystem';
import { CreatePackage } from './CreatePackage';
import SfpPackage, { PackageType, SfpPackageParams } from '../SfpPackage';
import { PackageCreationParams } from '../SfpPackageBuilder';
import { BuildStreamService } from '../../eventStream/build';

const SFDMU_CONFIG = 'export.json';
const VLOCITY_CONFIG = 'VlocityComponents.yaml';

export default class CreateDataPackageImpl extends CreatePackage {
    public constructor(
        protected projectDirectory: string,
        protected sfpPackage: SfpPackage,
        protected packageCreationParams: PackageCreationParams,
        protected logger?: Logger,
        protected params?: SfpPackageParams
    ) {
        super(projectDirectory, sfpPackage, packageCreationParams, logger, params);
    }

    getTypeOfPackage() {
        return PackageType.Data;
    }

    isEmptyPackage(projectDirectory: string, packageDirectory: string): boolean {
        let files: string[] = FileSystem.readdirRecursive(path.join(projectDirectory, packageDirectory));

        let hasExportJson = files.find((file) => path.basename(file) === 'export.json');

        let hasCsvFile = files.find((file) => path.extname(file) === '.csv');

        let hasYAMLFile = files.find((file) => path.extname(file) === '.yaml'); //check for vlocity config

        if(hasYAMLFile) return false;

        if (!hasExportJson || !hasCsvFile) return true;
        else return false;
    }

    preCreatePackage(sfpPackage) {
        this.validateDataPackage(sfpPackage.resolvedPackageDirectory);
    }

    createPackage(sfpPackage: SfpPackage) {
        //Do Nothing, as no external calls or processing is required
    }

    postCreatePackage(sfpPackage: SfpPackage) {}

    printAdditionalPackageSpecificHeaders() {}

    // Validate type of data package and existence of the correct configuration files
    private validateDataPackage(packageDirectory: string) {
        const files = FileSystem.readdirRecursive(packageDirectory);
        let isSfdmu: boolean;
        let isVlocity: boolean;

        for (const file of files) {
            if (path.basename(file) === SFDMU_CONFIG) isSfdmu = true;
            if (path.basename(file) === VLOCITY_CONFIG) isVlocity = true;
        }

        if (isSfdmu && isVlocity) {
            BuildStreamService.sendPackageError(this.sfpPackage,`Data package '${this.sfpPackage.packageName}' contains both SFDMU & Vlocity configuration`)
            throw new Error(
                `Data package '${this.sfpPackage.packageName}' contains both SFDMU & Vlocity configuration`
            );
        } else if (isSfdmu) {
            SFPLogger.log(
                `Found export.json in ${packageDirectory}.. Utilizing it as data package and will be deployed using sfdmu`,
                LoggerLevel.INFO,
                this.logger
            );
        } else if (isVlocity) {
            SFPLogger.log(
                `Found VlocityComponents.yaml in ${packageDirectory}.. Utilizing it as data package and will be deployed using vbt`,
                LoggerLevel.INFO,
                this.logger
            );
        } else {
            BuildStreamService.sendPackageError(this.sfpPackage,`Could not find export.json or VlocityComponents.yaml in ${packageDirectory}. sfpowerscripts only support vlocity or sfdmu based data packages`)
            throw new Error(
                `Could not find export.json or VlocityComponents.yaml in ${packageDirectory}. sfpowerscripts only support vlocity or sfdmu based data packages`
            );
        }
    }
}
