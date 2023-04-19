import ProjectConfig from '../../project/ProjectConfig';
import SFPLogger, { LoggerLevel, Logger, COLOR_KEY_MESSAGE } from '@dxatscale/sfp-logger';
import * as fs from 'fs-extra';
import { delay } from '../../utils/Delay';
import SfpPackage, { PackageType, SfpPackageParams } from '../SfpPackage';
import { CreatePackage } from './CreatePackage';
import PackageEmptyChecker from '../validators/PackageEmptyChecker';
import PackageVersionCoverage from '../coverage/PackageVersionCoverage';
import { Connection, SfProject } from '@salesforce/core';
import SFPStatsSender from '../../stats/SFPStatsSender';
import { EOL } from 'os';
import SFPOrg, { PackageTypeInfo } from '../../org/SFPOrg';
import { PackageCreationParams } from '../SfpPackageBuilder';
import { PackageVersion, PackageVersionCreateRequestResult } from '@salesforce/packaging';
import { Duration } from '@salesforce/kit';
import PackageDependencyDisplayer from '../../display/PackageDependencyDisplayer';
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

        SFPLogger.log(`Package ${packageTypeInfo.Name}`, LoggerLevel.INFO, this.logger);
        SFPLogger.log(`IsOrgDependent ${packageTypeInfo.IsOrgDependent}`, LoggerLevel.INFO, this.logger);
        SFPLogger.log(`Package Id ${packageTypeInfo.Id}`, LoggerLevel.INFO, this.logger);
        SFPLogger.log('-------------------------', LoggerLevel.INFO, this.logger);

        //cleanup sfpowerscripts constructs in working directory
        this.deleteSFPowerscriptsAdditionsToProjectConfig(this.workingDirectory);

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

        //Print Dependencies
        PackageDependencyDisplayer.printPackageDependencies(sfpPackage.dependencies,sfpPackage.projectConfig, this.logger);

    }

    async createPackage(sfpPackage: SfpPackage) {
        const sfProject = await SfProject.resolve(this.workingDirectory);

        // fix for #1202
        // bug packaging lib doesnt support unpackaged metadata from working directory which is not the root
        // it keeps on searching for the unpackage in the root folder
        // so fix up the path manually
        let targetPackageDir = sfProject.getPackageDirectories()[0];
        if (targetPackageDir['unpackagedMetadata'])
            targetPackageDir['unpackagedMetadata'] = { path: path.join(this.workingDirectory, 'unpackagedMetadata') };

        let result = await PackageVersion.create(
            {
                connection: this.devhubOrg.getConnection(),
                project: sfProject,
                installationkey: this.packageCreationParams.installationkey,
                installationkeybypass: this.packageCreationParams.installationkeybypass,
                tag: sfpPackage.tag,
                skipvalidation:
                    this.packageCreationParams.isSkipValidation && !this.isOrgDependentPackage ? true : false,
                codecoverage:
                    this.packageCreationParams.isCoverageEnabled && !this.isOrgDependentPackage ? true : false,
                versionnumber: sfpPackage.versionNumber,
                definitionfile: path.join(this.workingDirectory, this.params.configFilePath),
                packageId: this.sfpPackage.packageName,
            },
            { timeout: Duration.minutes(0), frequency: Duration.seconds(30) }
        );

        SFPLogger.log(`Package creation for ${this.sfpPackage.packageName} Initiated`, LoggerLevel.INFO, this.logger);
        //Poll for package creation every 30 seconds
        let currentPackageCreationStatus: PackageVersionCreateRequestResult;
        while (true) {
            await delay(30000); //Poll every 30 seconds
            currentPackageCreationStatus = await PackageVersion.getCreateStatus(
                result.Id,
                this.devhubOrg.getConnection()
            );

            //Too Verbose when reading errors.. use only for debug
            SFPLogger.log(
                `Status: ${COLOR_KEY_MESSAGE(currentPackageCreationStatus.Status)}, Next Status check in 30 seconds`,
                LoggerLevel.DEBUG,
                this.logger
            );
            if (currentPackageCreationStatus.Status === `Success`) {
                break;
            } else if (currentPackageCreationStatus.Status === 'Error') {
                let errorMessage = '<empty>';
                const errors = currentPackageCreationStatus?.Error;
                if (errors?.length) {
                    errorMessage = 'Creation errors: ';
                    for (let i = 0; i < errors.length; i++) {
                        errorMessage += `\n${i + 1}) ${errors[i]}`;
                    }
                }
                throw new Error(`Unable to create ${this.sfpPackage.packageName} due to \n` + errorMessage);
            }
        }

        SFPLogger.log(`Package Result:${JSON.stringify(currentPackageCreationStatus)}`, LoggerLevel.TRACE, this.logger);

        //Get the full details on the package and throw an error if the result is null, usually when the comamnd is timed out
        if (currentPackageCreationStatus.SubscriberPackageVersionId) {
            sfpPackage.package_version_id = currentPackageCreationStatus.SubscriberPackageVersionId;
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
        //copy the original config back as existing one would have cleaned up
        fs.copyFileSync(
            path.join(this.workingDirectory, 'sfdx-project-bak.json'),
            path.join(this.workingDirectory, 'sfdx-project.json')
        );
        fs.unlinkSync(path.join(this.workingDirectory, 'sfdx-project-bak.json'));
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

    private deleteSFPowerscriptsAdditionsToProjectConfig(workingDirectory: string) {
        let projectManifestFromWorkingDirectory = ProjectConfig.getSFDXProjectConfig(workingDirectory);
        let packageDescriptorInWorkingDirectory = ProjectConfig.getPackageDescriptorFromConfig(
            this.sfpPackage.packageName,
            projectManifestFromWorkingDirectory
        );

        fs.writeJsonSync(path.join(workingDirectory, 'sfdx-project-bak.json'), projectManifestFromWorkingDirectory);

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
        delete packageDescriptorInWorkingDirectory['tags'];

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
