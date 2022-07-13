import child_process = require('child_process');
import ProjectConfig from '../../project/ProjectConfig';
import SFPLogger, { LoggerLevel, Logger } from '@dxatscale/sfp-logger';
import * as fs from 'fs-extra';
import { delay } from '../../utils/Delay';
import SfpPackage, { PackageType, SfpPackageParams } from '../SfpPackage';
import { CreatePackage } from './CreatePackage';
import CreateUnlockedPackageVersionImpl from '../../sfdxwrappers/CreateUnlockedPackageVersionImpl';
import PackageEmptyChecker from '../PackageEmptyChecker';
import PackageVersionCoverage from '../coverage/PackageVersionCoverage';
import { Connection } from '@salesforce/core';
import SFPStatsSender from '../../stats/SFPStatsSender';
import { EOL } from 'os';
import SFPOrg, { PackageTypeInfo } from '../../org/SFPOrg';
import { PackageCreationParams } from '../SfpPackageBuilder';
const path = require('path');

export default class CreateUnlockedPackageImpl extends CreatePackage {
    private static packageTypeInfos: PackageTypeInfo[];
    private isOrgDependentPackage: boolean = false;
    private connection: Connection;
    private devhubOrg: SFPOrg;
    workingDirectory: string;

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
        return PackageType.Unlocked;
    }

    async preCreatePackage(sfpPackage: SfpPackage) {
        this.devhubOrg = await SFPOrg.create({ aliasOrUsername: this.packageCreationParams.devHub });

        this.connection = this.devhubOrg.getConnection();

        let packageId = ProjectConfig.getPackageId(sfpPackage.projectConfig, this.sfpPackage.packageName);

        // Get working directory
        this.workingDirectory = sfpPackage.workingDirectory;

        //Get the one in working directory, this is always hardcoded to match
        this.params.configFilePath = path.join('config', 'project-scratch-def.json');

        //Get Type of Package
        SFPLogger.log('Fetching Package Type Info from DevHub', LoggerLevel.INFO, this.logger);
        let packageTypeInfos = await this.getPackageTypeInfos();
        let packageTypeInfo = packageTypeInfos.find((pkg) => pkg.Id == packageId);
        if (packageTypeInfo == null) {
            SFPLogger.log(
                'Unable to find a package info for this particular package, Are you sure you created this package?',
                LoggerLevel.WARN,
                this.logger
            );
            throw new Error('Unable to fetch Package Info');
        }

        if (packageTypeInfo.IsOrgDependent == 'Yes') this.isOrgDependentPackage = true;

        SFPLogger.log(`Package  ${packageTypeInfo.Name}`, LoggerLevel.INFO, this.logger);
        SFPLogger.log(`IsOrgDependent ${packageTypeInfo.IsOrgDependent}`, LoggerLevel.INFO, this.logger);
        SFPLogger.log(`Package Id  ${packageTypeInfo.Id}`, LoggerLevel.INFO, this.logger);
        SFPLogger.log('-------------------------', LoggerLevel.INFO, this.logger);

        //cleanup sfpowerscripts constructs in working directory
        this.deleteSFPowerscriptsAdditionsToManifest(this.workingDirectory);

        //Resolve the package dependencies
        if (this.isOrgDependentPackage) {
            // Store original dependencies to artifact
            sfpPackage.dependencies = sfpPackage.packageDescriptor['dependencies'];
        } else if (!this.isOrgDependentPackage && !this.packageCreationParams.isSkipValidation) {
            sfpPackage.packageDescriptor = ProjectConfig.getSFDXPackageDescriptor(
                this.workingDirectory,
                this.sfpPackage.packageName
            );
            //Store the resolved dependencies
            sfpPackage.dependencies = sfpPackage.packageDescriptor['dependencies'];
        } else {
            sfpPackage.dependencies = sfpPackage.packageDescriptor['dependencies'];
        }
    }

    async createPackage(sfpPackage: SfpPackage) {
        let createUnlockedPackageImpl: CreateUnlockedPackageVersionImpl = new CreateUnlockedPackageVersionImpl(
            this.packageCreationParams.devHub,
            this.workingDirectory, //Use working directory for unlocked package
            this.sfpPackage.packageName,
            this.packageCreationParams.waitTime,
            this.params.configFilePath,
            this.logger,
            LoggerLevel.INFO,
            this.params.packageVersionNumber,
            this.packageCreationParams.installationkeybypass,
            this.packageCreationParams.installationkey,
            sfpPackage.tag,
            this.packageCreationParams.isSkipValidation,
            this.isOrgDependentPackage,
            this.packageCreationParams.isCoverageEnabled
        );

        let result = await createUnlockedPackageImpl.exec(true);

        SFPLogger.log(`Package Result:${JSON.stringify(result)}`, LoggerLevel.TRACE, this.logger);

        //Get the full details on the package and throw an error if the result is null, usually when the comamnd is timed out
        if (result.SubscriberPackageVersionId) {
            sfpPackage.package_version_id = result.SubscriberPackageVersionId;
            await this.getPackageInfo(sfpPackage);
        } else {
            throw new Error(
                `The build for ${this.sfpPackage.packageName} was not completed in the wait time ${this.packageCreationParams.waitTime} provided.${EOL}
         You might want to increase the wait time or better check the dependencies or convert to different package type ${EOL}
         Read more about it here https://docs.dxatscale.io/development-practices/types-of-packaging/unlocked-packages#build-options-with-unlocked-packages`
            );
        }

        //Break if coverage is low
        if (this.packageCreationParams.isCoverageEnabled && !this.isOrgDependentPackage) {
            if (!sfpPackage.has_passed_coverage_check)
                throw new Error('This package has not meet the minimum coverage requirement of 75%');
        }
    }

    postCreatePackage(sfpPackage: SfpPackage) {
        if (sfpPackage.isDependencyValidated) {
            SFPStatsSender.logGauge('package.testcoverage', sfpPackage.test_coverage, {
                package: sfpPackage.package_name,
                from: 'createpackage',
            });
        }
    }

    isEmptyPackage(projectDirectory: string, packageDirectory: string) {
        return PackageEmptyChecker.isEmptyFolder(projectDirectory, packageDirectory);
    }

    printAdditionalPackageSpecificHeaders() {}

    private deleteSFPowerscriptsAdditionsToManifest(workingDirectory: string) {
        let projectManifestFromWorkingDirectory = ProjectConfig.getSFDXProjectConfig(workingDirectory);
        let packageDescriptorInWorkingDirectory = ProjectConfig.getPackageDescriptorFromConfig(
            this.sfpPackage.packageName,
            projectManifestFromWorkingDirectory
        );

        //Cleanup sfpowerscripts constructs
        if (this.isOrgDependentPackage) delete packageDescriptorInWorkingDirectory['dependencies'];

        delete packageDescriptorInWorkingDirectory['type'];
        delete packageDescriptorInWorkingDirectory['assignPermSetsPreDeployment'];
        delete packageDescriptorInWorkingDirectory['assignPermSetsPostDeployment'];
        delete packageDescriptorInWorkingDirectory['skipDeployOnOrgs'];
        delete packageDescriptorInWorkingDirectory['skipTesting'];
        delete packageDescriptorInWorkingDirectory['skipCoverageValidation'];
        delete packageDescriptorInWorkingDirectory['ignoreOnStages'];
        delete packageDescriptorInWorkingDirectory['ignoreDeploymentErrors'];
        delete packageDescriptorInWorkingDirectory['preDeploymentScript'];
        delete packageDescriptorInWorkingDirectory['postDeploymentScript'];
        delete packageDescriptorInWorkingDirectory['aliasfy'];
        delete packageDescriptorInWorkingDirectory['checkpointForPrepare'];
        delete packageDescriptorInWorkingDirectory['testSynchronous'];

        fs.writeJsonSync(path.join(workingDirectory, 'sfdx-project.json'), projectManifestFromWorkingDirectory);
    }

    private async getPackageInfo(sfpPackage: SfpPackage) {
        let packageVersionCoverage: PackageVersionCoverage = new PackageVersionCoverage(this.connection, this.logger);
        let count = 0;
        while (count < 10) {
            count++;
            try {
                SFPLogger.log('Fetching Version Number and Coverage details', LoggerLevel.INFO, this.logger);

                let pkgInfoResult = await packageVersionCoverage.getCoverage(sfpPackage.package_version_id);

                sfpPackage.isDependencyValidated = !this.packageCreationParams.isSkipValidation;
                sfpPackage.package_version_number = pkgInfoResult.packageVersionNumber;
                sfpPackage.test_coverage = pkgInfoResult.coverage;
                sfpPackage.has_passed_coverage_check = pkgInfoResult.HasPassedCodeCoverageCheck;
                break;
            } catch (error) {
                SFPLogger.log(
                    `Unable to fetch package version info due to ${error.message}`,
                    LoggerLevel.INFO,
                    this.logger
                );
                SFPLogger.log('Retrying...', LoggerLevel.INFO, this.logger);
                await delay(2000);
                continue;
            }
        }
    }

    private async getPackageTypeInfos() {
        if (CreateUnlockedPackageImpl.packageTypeInfos == null) {
            CreateUnlockedPackageImpl.packageTypeInfos = await this.devhubOrg.listAllPackages();
        }
        return CreateUnlockedPackageImpl.packageTypeInfos;
    }
}
