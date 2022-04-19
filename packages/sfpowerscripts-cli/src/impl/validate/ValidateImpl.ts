import child_process = require('child_process');
import BuildImpl, { BuildProps } from '../parallelBuilder/BuildImpl';
import DeployImpl, { DeploymentMode, DeployProps, DeploymentResult } from '../deploy/DeployImpl';
import ArtifactGenerator from '@dxatscale/sfpowerscripts.core/lib/artifacts/generators/ArtifactGenerator';
import PackageMetadata from '@dxatscale/sfpowerscripts.core/lib/PackageMetadata';
import { Stage } from '../Stage';
import SFPLogger, { ConsoleLogger, Logger, LoggerLevel } from '@dxatscale/sfpowerscripts.core/lib/logger/SFPLogger';
import fs = require('fs');
import InstallPackageDependenciesImpl from '@dxatscale/sfpowerscripts.core/lib/sfdxwrappers/InstallPackageDependenciesImpl';
import {
    PackageInstallationResult,
    PackageInstallationStatus,
} from '@dxatscale/sfpowerscripts.core/lib/package/packageInstallers/PackageInstallationResult';
import PoolFetchImpl from '@dxatscale/sfpowerscripts.core/lib/scratchorg/pool/PoolFetchImpl';
import { Org } from '@salesforce/core';
import InstalledArtifactsDisplayer from '@dxatscale/sfpowerscripts.core/lib/display/InstalledArtifactsDisplayer';
import ValidateError from '../../errors/ValidateError';
import ChangedComponentsFetcher from '@dxatscale/sfpowerscripts.core/lib/dependency/ChangedComponentsFetcher';
import DependencyAnalysis from '@dxatscale/sfpowerscripts.core/lib/dependency/DependencyAnalysis';
import DependencyViolationDisplayer from '@dxatscale/sfpowerscripts.core/lib/display/DependencyViolationDisplayer';
import ImpactAnalysis from './ImpactAnalysis';
import ScratchOrg from '@dxatscale/sfpowerscripts.core/lib/scratchorg/ScratchOrg';
import { COLOR_KEY_MESSAGE } from '@dxatscale/sfpowerscripts.core/lib/logger/SFPLogger';
import { COLOR_WARNING } from '@dxatscale/sfpowerscripts.core/lib/logger/SFPLogger';
import { COLOR_ERROR } from '@dxatscale/sfpowerscripts.core/lib/logger/SFPLogger';
import { COLOR_HEADER } from '@dxatscale/sfpowerscripts.core/lib/logger/SFPLogger';
import { COLOR_SUCCESS } from '@dxatscale/sfpowerscripts.core/lib/logger/SFPLogger';
import { COLOR_TIME } from '@dxatscale/sfpowerscripts.core/lib/logger/SFPLogger';
import SFPStatsSender from '@dxatscale/sfpowerscripts.core/lib/stats/SFPStatsSender';
import ScratchOrgInfoFetcher from '@dxatscale/sfpowerscripts.core/lib/scratchorg/pool/services/fetchers/ScratchOrgInfoFetcher';
import Component from '@dxatscale/sfpowerscripts.core/lib/dependency/Component';
import ValidateResult from './ValidateResult';
import PoolOrgDeleteImpl from '@dxatscale/sfpowerscripts.core/lib/scratchorg/pool/PoolOrgDeleteImpl';
import SFPOrg from '@dxatscale/sfpowerscripts.core/lib/org/SFPOrg';
import SFPPackage from '@dxatscale/sfpowerscripts.core/lib/package/SFPPackage';
import { TestOptions } from '@dxatscale/sfpowerscripts.core/lib/apextest/TestOptions';
import {
    RunAllTestsInPackageOptions,
    RunSpecifiedTestsOption,
} from '@dxatscale/sfpowerscripts.core/lib/apextest/TestOptions';
import { CoverageOptions } from '@dxatscale/sfpowerscripts.core/lib/apex/coverage/IndividualClassCoverage';
import TriggerApexTests from '@dxatscale/sfpowerscripts.core/lib/apextest/TriggerApexTests';
import getFormattedTime from '@dxatscale/sfpowerscripts.core/lib/utils/GetFormattedTime';
import { PostDeployHook } from '../deploy/PostDeployHook';
import ImpactedApexTestClassFetcher from '@dxatscale/sfpowerscripts.core/lib/apextest/ImpactedApexTestClassFetcher';
import * as rimraf from 'rimraf';

export enum ValidateMode {
    ORG,
    POOL,
}

export interface ValidateProps {
    validateMode: ValidateMode;
    coverageThreshold: number;
    logsGroupSymbol: string[];
    targetOrg?: string;
    hubOrg?: Org;
    pools?: string[];
    shapeFile?: string;
    isDeleteScratchOrg?: boolean;
    keys?: string;
    baseBranch?: string;
    isImpactAnalysis?: boolean;
    isDependencyAnalysis?: boolean;
    diffcheck?: boolean;
    disableArtifactCommit?: boolean;
    isFastFeedbackMode?: boolean;
}

export default class ValidateImpl implements PostDeployHook {
    private changedComponents: Component[];
    private logger = new ConsoleLogger();
    private orgAsSFPOrg: SFPOrg;

    constructor(private props: ValidateProps) {}

    public async exec(): Promise<ValidateResult> {

        rimraf.sync('artifacts');

        let scratchOrgUsername: string;
        try {
            if (this.props.validateMode === ValidateMode.ORG) {
                scratchOrgUsername = this.props.targetOrg;
            } else if (this.props.validateMode === ValidateMode.POOL) {
                if(process.env.SFPOWERSCRIPTS_DEBUG_PREFETCHED_SCRATCHORG)
                    scratchOrgUsername = process.env.SFPOWERSCRIPTS_DEBUG_PREFETCHED_SCRATCHORG
                else
                    scratchOrgUsername = await this.fetchScratchOrgFromPool(this.props.pools);
                if(!this.props.isFastFeedbackMode)
                  await this.installPackageDependencies(scratchOrgUsername);
            } else throw new Error(`Unknown mode ${this.props.validateMode}`);

            //Create Org
            this.orgAsSFPOrg = await SFPOrg.create({ aliasOrUsername: scratchOrgUsername });
            let connToScratchOrg = this.orgAsSFPOrg.getConnection();
            let installedArtifacts;
            try {
                installedArtifacts = await this.orgAsSFPOrg.getInstalledArtifacts();
            } catch {
                console.log(COLOR_ERROR('Failed to query org for Sfpowerscripts Artifacts'));
                console.log(COLOR_KEY_MESSAGE('Building all packages'));
            }

            let packagesToCommits: { [p: string]: string } = {};

            if (installedArtifacts != null) {
                packagesToCommits = this.getPackagesToCommits(installedArtifacts);
                this.printArtifactVersions(installedArtifacts);
            }

            await this.buildChangedSourcePackages(packagesToCommits);

            let deploymentResult = await this.deploySourcePackages(scratchOrgUsername);

            if (deploymentResult.failed.length > 0 || deploymentResult.error)
                throw new ValidateError('Validation failed', { deploymentResult });
            else {
                //Do dependency analysis
                await this.dependencyAnalysis(this.orgAsSFPOrg, deploymentResult);

                //Display impact analysis
                await this.impactAnalysis(connToScratchOrg);
            }

            return null;
        } finally {
            if (this.props.isDeleteScratchOrg) {
                await this.deleteScratchOrg(scratchOrgUsername);
            } else {
                fs.writeFileSync('.env', `sfpowerscripts_scratchorg_username=${scratchOrgUsername}\n`, { flag: 'a' });
                console.log(`sfpowerscripts_scratchorg_username=${scratchOrgUsername}`);
            }
        }
    }

    private async dependencyAnalysis(orgAsSFPOrg: SFPOrg, deploymentResult: DeploymentResult) {
        if (this.props.isDependencyAnalysis) {
            this.printOpenLoggingGroup(`Validate Dependency tree`);
            SFPLogger.log(
                COLOR_HEADER(
                    `-------------------------------------------------------------------------------------------`
                )
            );
            SFPLogger.log(COLOR_KEY_MESSAGE('Validating dependency  tree of changed components..'), LoggerLevel.INFO);
            const changedComponents = await this.getChangedComponents();
            const dependencyAnalysis = new DependencyAnalysis(orgAsSFPOrg, changedComponents);

            let dependencyViolations = await dependencyAnalysis.exec();

            if (dependencyViolations.length > 0) {
                DependencyViolationDisplayer.printDependencyViolations(dependencyViolations);

                //TODO: Just Print for now, will throw errors once org dependent is identified
                // deploymentResult.error = `Dependency analysis failed due to ${JSON.stringify(dependencyViolations)}`;
                // throw new ValidateError(`Dependency Analysis Failed`, { deploymentResult });
            } else {
                SFPLogger.log(COLOR_SUCCESS('No Dependency violations found so far'), LoggerLevel.INFO);
            }

            SFPLogger.log(
                COLOR_HEADER(
                    `-------------------------------------------------------------------------------------------`
                )
            );
            this.printClosingLoggingGroup();
            return dependencyViolations;
        }
    }

    private async impactAnalysis(connToScratchOrg) {
        if (this.props.isImpactAnalysis) {
            const changedComponents = await this.getChangedComponents();
            try {
                const impactAnalysis = new ImpactAnalysis(connToScratchOrg, changedComponents);
                await impactAnalysis.exec();
            } catch (err) {
                console.log(err.message);
                console.log('Failed to perform impact analysis');
            }
        }
    }

    /**
     *
     * @returns array of components that have changed, can be empty
     */
    private async getChangedComponents(): Promise<Component[]> {
        if (this.changedComponents) return this.changedComponents;
        else return new ChangedComponentsFetcher(this.props.baseBranch).fetch();
    }

    private async installPackageDependencies(scratchOrgUsername: string) {
        this.printOpenLoggingGroup(`Installing Package Dependencies of this repo in ${scratchOrgUsername}`);

        // Install Dependencies
        let installDependencies: InstallPackageDependenciesImpl = new InstallPackageDependenciesImpl(
            scratchOrgUsername,
            this.props.hubOrg.getUsername(),
            120,
            null,
            this.props.keys,
            true,
            null
        );
        let installationResult = await installDependencies.exec();
        if (installationResult.result == PackageInstallationStatus.Failed) {
            throw new Error(installationResult.message);
        }
        console.log(
            COLOR_KEY_MESSAGE(
                `Successfully completed Installing Package Dependencies of this repo in ${scratchOrgUsername}`
            )
        );
        this.printClosingLoggingGroup();
    }

    private async deleteScratchOrg(scratchOrgUsername: string) {
        try {
            if (scratchOrgUsername && this.props.hubOrg.getUsername()) {
                console.log(`Deleting scratch org`, scratchOrgUsername);
                let poolOrgDeleteImpl = new PoolOrgDeleteImpl(this.props.hubOrg, scratchOrgUsername);
                await poolOrgDeleteImpl.execute();
            }
        } catch (error) {
            console.log(COLOR_WARNING(error.message));
        }
    }

    private deployShapeFile(shapeFile: string, scratchOrgUsername: string): void {
        console.log(COLOR_KEY_MESSAGE(`Deploying scratch org shape`), shapeFile);
        child_process.execSync(
            `sfdx force:mdapi:deploy -f ${shapeFile} -u ${scratchOrgUsername} -w 30 --ignorewarnings`,
            {
                stdio: 'inherit',
                encoding: 'utf8',
            }
        );
    }

    private async deploySourcePackages(scratchOrgUsername: string): Promise<DeploymentResult> {
        let deployStartTime: number = Date.now();

        let deployProps: DeployProps = {
            targetUsername: scratchOrgUsername,
            artifactDir: 'artifacts',
            waitTime: 120,
            deploymentMode: DeploymentMode.SOURCEPACKAGES,
            isTestsToBeTriggered: true,
            skipIfPackageInstalled: false,
            logsGroupSymbol: this.props.logsGroupSymbol,
            currentStage: Stage.VALIDATE,
            disableArtifactCommit: this.props.disableArtifactCommit,
            isFastFeedbackMode:this.props.isFastFeedbackMode
        };

        let deployImpl: DeployImpl = new DeployImpl(deployProps);
        deployImpl.postDeployHook = this;

        let deploymentResult = await deployImpl.exec();

        let deploymentElapsedTime: number = Date.now() - deployStartTime;
        this.printDeploySummary(deploymentResult, deploymentElapsedTime);

        return deploymentResult;
    }

    private async triggerApexTests(
        sfpPackage: SFPPackage,
        targetUsername: string,
        logger: Logger
    ): Promise<{
        id: string;
        result: boolean;
        message: string;
    }> {
        if (sfpPackage.packageDescriptor.skipTesting) return { id: null, result: true, message: 'No Tests To Run' };

        if (!sfpPackage.isApexInPackage) return { id: null, result: true, message: 'No Tests To Run' };

      
        let testOptions: TestOptions, testCoverageOptions: CoverageOptions;

        if (!this.props.isFastFeedbackMode) {
            this.displayTestHeader(sfpPackage);
            testOptions = new RunAllTestsInPackageOptions(sfpPackage, 60, '.testresults');
            testCoverageOptions = {
                isIndividualClassCoverageToBeValidated: false,
                isPackageCoverageToBeValidated: !sfpPackage.packageDescriptor.skipCoverageValidation,
                coverageThreshold: this.props.coverageThreshold || 75,
            };
        } else {
           
            let changedComponents = await this.getChangedComponents();
            let impactedApexTestClassFetcher: ImpactedApexTestClassFetcher = new ImpactedApexTestClassFetcher(
                sfpPackage,
                changedComponents,
                this.logger
            );

            let impactedTestClasses = await impactedApexTestClassFetcher.getImpactedTestClasses();
            if (impactedTestClasses.length == 0)
                return { id: null, result: true, message: 'No Apex Classes were impacted, Skipping Tests' };

            this.displayTestHeader(sfpPackage);
            SFPLogger.log(`${COLOR_HEADER('Fast Feedback Mode activated, Only impacted test class will be triggered')}`)
            testOptions = new RunSpecifiedTestsOption(60, '.testResults', impactedTestClasses.join(), sfpPackage.packageDescriptor.testSynchronous);
            testCoverageOptions = {
                isIndividualClassCoverageToBeValidated: false,
                isPackageCoverageToBeValidated: false,
                coverageThreshold:0
            };
        }

        let triggerApexTests: TriggerApexTests = new TriggerApexTests(
            targetUsername,
            testOptions,
            testCoverageOptions,
            null,
            logger
        );

        return triggerApexTests.exec();
    }

    private displayTestHeader(sfpPackage: SFPPackage) {
        SFPLogger.log(
            COLOR_HEADER(`-------------------------------------------------------------------------------------------`)
        );
        SFPLogger.log(`Triggering Apex tests for ${sfpPackage.package_name}`, LoggerLevel.INFO);
        SFPLogger.log(
            COLOR_HEADER(`-------------------------------------------------------------------------------------------`)
        );
    }

    private async buildChangedSourcePackages(packagesToCommits: { [p: string]: string }): Promise<any> {
        this.printOpenLoggingGroup('Building Packages');

        let buildStartTime: number = Date.now();

        let buildProps: BuildProps = {
            buildNumber: 1,
            executorcount: 10,
            waitTime: 120,
            isDiffCheckEnabled: this.props.diffcheck,
            isQuickBuild: true,
            isBuildAllAsSourcePackages: true,
            packagesToCommits: packagesToCommits,
            currentStage: Stage.VALIDATE,
        };

        let buildImpl: BuildImpl = new BuildImpl(buildProps);

        let { generatedPackages, failedPackages } = await buildImpl.exec();

        if (failedPackages.length > 0) throw new Error(`Failed to create source packages ${failedPackages}`);

        if (generatedPackages.length === 0) {
            throw new Error(
                `No changes detected in the packages to be built \n, validate will only execute if there is a change in atleast one of the packages`
            );
        }

        for (let generatedPackage of generatedPackages) {
            try {
                await ArtifactGenerator.generateArtifact(
                    generatedPackage.package_name,
                    process.cwd(),
                    'artifacts',
                    generatedPackage
                );
            } catch (error) {
                console.log(COLOR_ERROR(`Unable to create artifact for ${generatedPackage.package_name}`));
                throw error;
            }
        }
        let buildElapsedTime: number = Date.now() - buildStartTime;

        this.printBuildSummary(generatedPackages, failedPackages, buildElapsedTime);

        this.printClosingLoggingGroup();

        return generatedPackages;
    }

    private getPackagesToCommits(installedArtifacts: any): { [p: string]: string } {
        let packagesToCommits: { [p: string]: string } = {};

        // Construct map of artifact and associated commit Id
        installedArtifacts.forEach((artifact) => {
            packagesToCommits[artifact.Name] = artifact.CommitId__c;
        });

        return packagesToCommits;
    }

    private printArtifactVersions(installedArtifacts: any) {
        this.printOpenLoggingGroup(`Artifacts installed in the Scratch Org`);

        InstalledArtifactsDisplayer.printInstalledArtifacts(installedArtifacts, null);

        this.printClosingLoggingGroup();
    }

    private async fetchScratchOrgFromPool(pools: string[]): Promise<string> {
        let scratchOrgUsername: string;

        for (let pool of pools) {
            let scratchOrg: ScratchOrg;
            try {
                let poolFetchImpl = new PoolFetchImpl(this.props.hubOrg, pool.trim(), false, true);
                scratchOrg = (await poolFetchImpl.execute()) as ScratchOrg;
            } catch (error) {
                SFPLogger.log(error.message, LoggerLevel.TRACE);
            }
            if (scratchOrg && scratchOrg.status === 'Assigned') {
                scratchOrgUsername = scratchOrg.username;
                console.log(`Fetched scratch org ${scratchOrgUsername} from ${pool}`);
                this.getCurrentRemainingNumberOfOrgsInPoolAndReport(scratchOrg.tag);
                break;
            }
        }

        if (scratchOrgUsername) return scratchOrgUsername;
        else
            throw new Error(
                `Failed to fetch scratch org from ${pools}, Are you sure you created this pool using a DevHub authenticated using auth:sfdxurl or auth:web or auth:accesstoken:store`
            );
    }

    private async getCurrentRemainingNumberOfOrgsInPoolAndReport(tag: string) {
        try {
            const results = await new ScratchOrgInfoFetcher(this.props.hubOrg).getScratchOrgsByTag(tag, false, true);

            let availableSo = results.records.filter((soInfo) => soInfo.Allocation_status__c === 'Available');

            SFPStatsSender.logGauge('pool.available', availableSo.length, {
                poolName: tag,
            });
        } catch (error) {
            //do nothing, we are not reporting anything if anything goes wrong here
        }
    }

    private printBuildSummary(
        generatedPackages: PackageMetadata[],
        failedPackages: string[],
        totalElapsedTime: number
    ): void {
        console.log(
            COLOR_HEADER(
                `----------------------------------------------------------------------------------------------------`
            )
        );
        console.log(
            COLOR_SUCCESS(
                `${generatedPackages.length} packages created in ${COLOR_TIME(
                    getFormattedTime(totalElapsedTime)
                )} with {${COLOR_ERROR(failedPackages.length)}} errors`
            )
        );

        if (failedPackages.length > 0) {
            console.log(COLOR_ERROR(`Packages Failed To Build`, failedPackages));
        }
        console.log(
            COLOR_HEADER(
                `----------------------------------------------------------------------------------------------------`
            )
        );
    }

    private printDeploySummary(deploymentResult: DeploymentResult, totalElapsedTime: number): void {
        if (this.props.logsGroupSymbol?.[0]) console.log(this.props.logsGroupSymbol[0], 'Deployment Summary');

        console.log(
            COLOR_HEADER(
                `----------------------------------------------------------------------------------------------------`
            )
        );
        console.log(
            COLOR_SUCCESS(
                `${deploymentResult.deployed.length} packages deployed in ${COLOR_TIME(
                    getFormattedTime(totalElapsedTime)
                )} with {${COLOR_ERROR(deploymentResult.failed.length)}} failed deployments`
            )
        );

        if (deploymentResult.failed.length > 0) {
            console.log(
                COLOR_ERROR(
                    `\nPackages Failed to Deploy`,
                    deploymentResult.failed.map((packageInfo) => packageInfo.packageMetadata.package_name)
                )
            );
        }

        console.log(
            COLOR_HEADER(
                `----------------------------------------------------------------------------------------------------`
            )
        );
        this.printClosingLoggingGroup();
    }

    private printOpenLoggingGroup(message: string, pkg?: string) {
        if (this.props.logsGroupSymbol?.[0])
            SFPLogger.log(`${this.props.logsGroupSymbol[0]} ${message} ${pkg ? pkg : ''}`, LoggerLevel.INFO);
    }

    private printClosingLoggingGroup() {
        if (this.props.logsGroupSymbol?.[1]) SFPLogger.log(this.props.logsGroupSymbol[1], LoggerLevel.INFO);
    }

    preDeployPackage(sfpPackage: SFPPackage, targetUsername: string, devhubUserName?: string): Promise<boolean> {
        throw new Error('Method not implemented.');
    }

    async postDeployPackage(
        sfpPackage: SFPPackage,
        packageInstallationResult: PackageInstallationResult,
        targetUsername: string,
        devhubUserName?: string
    ): Promise<{ isToFailDeployment: boolean; message?: string }> {
        //Trigger Tests after installation of each package
        if (sfpPackage.packageType && sfpPackage.packageType != 'data') {
            if (packageInstallationResult.result === PackageInstallationStatus.Succeeded) {
                //Get Changed Components
                let testResult = await this.triggerApexTests(sfpPackage, targetUsername, this.logger);
                return { isToFailDeployment: !testResult.result, message: testResult.message };
            }
        }
        return { isToFailDeployment: false };
    }
}
