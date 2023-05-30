import SFPLogger, { LoggerLevel, Logger } from '@dxatscale/sfp-logger';
import { EOL } from 'os';
import { ApexSortedByType, FileDescriptor } from '../../apex/parser/ApexTypeFetcher';
import SFPStatsSender from '../../stats/SFPStatsSender';
import PackageEmptyChecker from '../validators/PackageEmptyChecker';
import SfpPackage, { PackageType, SfpPackageParams } from '../SfpPackage';
import { CreatePackage } from './CreatePackage';
import { PackageCreationParams } from '../SfpPackageBuilder';
import { ZERO_BORDER_TABLE } from '../../display/TableConstants';
const Table = require('cli-table');

export default class CreateSourcePackageImpl extends CreatePackage {
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
        return PackageType.Source;
    }

    printAdditionalPackageSpecificHeaders() {}

    isEmptyPackage(projectDirectory: string, packageDirectory: string) {
        return PackageEmptyChecker.isEmptyFolder(projectDirectory, packageDirectory);
    }

    preCreatePackage(sfpPackage: SfpPackage) {}

    public async createPackage(sfpPackage: SfpPackage) {
        this.handleApexTestClasses(sfpPackage);

        SFPStatsSender.logGauge('package.metadatacount', sfpPackage.metadataCount, {
            package: sfpPackage.packageName,
            type: sfpPackage.packageType,
        });
    }

    postCreatePackage(sfpPackage) {}

    protected handleApexTestClasses(sfpPackage: SfpPackage) {
        let classTypes: ApexSortedByType = sfpPackage.apexClassesSortedByTypes;

        if (sfpPackage.isApexFound && classTypes?.testClass?.length == 0) {
            this.printSlowDeploymentWarning();
            sfpPackage.isTriggerAllTests = true;
        } else if (sfpPackage.isApexFound && classTypes?.testClass?.length > 0) {
            if (classTypes?.parseError?.length > 0) {
                SFPLogger.log(
                    '---------------------------------------------------------------------------------------',
                    LoggerLevel.INFO,
                    this.logger
                );
                SFPLogger.log(
                    'Unable to parse these classes to correctly identify test classes, Its not your issue, its ours!'+
                    'Please raise a issue in our repo!',
                    LoggerLevel.INFO,
                    this.logger
                );
                this.printClassesIdentified(classTypes?.parseError);
                sfpPackage.isTriggerAllTests = true;
            } else {
                this.printHintForOptimizedDeployment();
                sfpPackage.isTriggerAllTests = false;
                this.printClassesIdentified(classTypes?.testClass);
                sfpPackage.apexTestClassses = [];
                classTypes?.testClass.forEach((element) => {
                    sfpPackage.apexTestClassses.push(element.name);
                });
            }
        }
    }

    private printHintForOptimizedDeployment() {
        SFPLogger.log(
            `---------------- OPTION FOR DEPLOYMENT OPTIMIZATION AVAILABLE-----------------------------------`,
            null,
            this.logger
        );
        SFPLogger.log(
            `Following apex test classes were identified and can  be used for deploying this package,${EOL}` +
            `in an optimal manner, provided each individual class meets the test coverage requirement of 75% and above${EOL}` +
            `Ensure each apex class/trigger is validated for coverage in the validation stage`,
            null,
            this.logger
        );
        SFPLogger.log(
            `-----------------------------------------------------------------------------------------------`,
            LoggerLevel.INFO,
            this.logger
        );
    }

    private printSlowDeploymentWarning() {
        SFPLogger.log(
            `-------WARNING! YOU MIGHT NOT BE ABLE TO DEPLOY OR WILL HAVE A SLOW DEPLOYMENT---------------`,
            LoggerLevel.INFO,
            this.logger
        );
        SFPLogger.log(
            `This package has apex classes/triggers, however apex test classes were not found, You would not be able to deploy${EOL}` +
            `to production org optimally if each class do not have coverage of 75% and above,We will attempt deploying${EOL}` +
            `this package by triggering all local tests in the org which could be realy costly in terms of deployment time!${EOL}`,
            null,
            this.logger
        );
        SFPLogger.log(
            `---------------------------------------------------------------------------------------------`,
            LoggerLevel.INFO,
            this.logger
        );
    }

    private printClassesIdentified(fetchedClasses: FileDescriptor[]) {
        if (fetchedClasses === null || fetchedClasses === undefined) return;

        let table = new Table({
            head: ['Class', 'Error'],
            chars: ZERO_BORDER_TABLE
        });

        for (let fetchedClass of fetchedClasses) {
            let item = [fetchedClass.name, fetchedClass.error ? JSON.stringify(fetchedClass.error) : 'N/A'];
            table.push(item);
        }
        SFPLogger.log('Following apex test classes were identified', LoggerLevel.INFO, this.logger);
        SFPLogger.log(table.toString(), LoggerLevel.INFO, this.logger);
    }
}
