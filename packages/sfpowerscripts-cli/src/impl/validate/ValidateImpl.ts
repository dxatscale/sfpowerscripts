import BuildImpl, { BuildProps } from '../parallelBuilder/BuildImpl';
import DeployImpl, { DeploymentMode, DeployProps, DeploymentResult } from '../deploy/DeployImpl';
import ArtifactGenerator from '@dxatscale/sfpowerscripts.core/lib/artifacts/generators/ArtifactGenerator';
import { Stage } from '../Stage';
import SFPLogger, { COLOR_KEY_VALUE, COLOR_TRACE, ConsoleLogger, Logger, LoggerLevel } from '@dxatscale/sfp-logger';
import {
    PackageInstallationResult,
    PackageInstallationStatus,
} from '@dxatscale/sfpowerscripts.core/lib/package/packageInstallers/PackageInstallationResult';
import { PackageDiffOptions } from '@dxatscale/sfpowerscripts.core/lib/package/diff/PackageDiffImpl';
import PoolFetchImpl from '@dxatscale/sfpowerscripts.core/lib/scratchorg/pool/PoolFetchImpl';
import { Org } from '@salesforce/core';
import InstalledArtifactsDisplayer from '@dxatscale/sfpowerscripts.core/lib/display/InstalledArtifactsDisplayer';
import ValidateError from '../../errors/ValidateError';
import ChangedComponentsFetcher from '@dxatscale/sfpowerscripts.core/lib/dependency/ChangedComponentsFetcher';
import DependencyAnalysis from '@dxatscale/sfpowerscripts.core/lib/dependency/DependencyAnalysis';
import DependencyViolationDisplayer from '@dxatscale/sfpowerscripts.core/lib/display/DependencyViolationDisplayer';
import ImpactAnalysis from './ImpactAnalysis';
import ScratchOrg from '@dxatscale/sfpowerscripts.core/lib/scratchorg/ScratchOrg';
import { COLOR_KEY_MESSAGE } from '@dxatscale/sfp-logger';
import { COLOR_WARNING } from '@dxatscale/sfp-logger';
import { COLOR_ERROR } from '@dxatscale/sfp-logger';
import { COLOR_HEADER } from '@dxatscale/sfp-logger';
import { COLOR_SUCCESS } from '@dxatscale/sfp-logger';
import { COLOR_TIME } from '@dxatscale/sfp-logger';
import SFPStatsSender from '@dxatscale/sfpowerscripts.core/lib/stats/SFPStatsSender';
import ScratchOrgInfoFetcher from '@dxatscale/sfpowerscripts.core/lib/scratchorg/pool/services/fetchers/ScratchOrgInfoFetcher';
import ScratchOrgInfoAssigner from '@dxatscale/sfpowerscripts.core/lib/scratchorg/pool/services/updaters/ScratchOrgInfoAssigner';
import Component from '@dxatscale/sfpowerscripts.core/lib/dependency/Component';
import ValidateResult from './ValidateResult';
import PoolOrgDeleteImpl from '@dxatscale/sfpowerscripts.core/lib/scratchorg/pool/PoolOrgDeleteImpl';
import SFPOrg from '@dxatscale/sfpowerscripts.core/lib/org/SFPOrg';
import SfpPackage, { PackageType } from '@dxatscale/sfpowerscripts.core/lib/package/SfpPackage';
import { TestOptions } from '@dxatscale/sfpowerscripts.core/lib/apextest/TestOptions';
import {
    RunAllTestsInPackageOptions,
    RunSpecifiedTestsOption,
} from '@dxatscale/sfpowerscripts.core/lib/apextest/TestOptions';
import { CoverageOptions } from '@dxatscale/sfpowerscripts.core/lib/apex/coverage/IndividualClassCoverage';
import TriggerApexTests from '@dxatscale/sfpowerscripts.core/lib/apextest/TriggerApexTests';
import getFormattedTime from '@dxatscale/sfpowerscripts.core/lib/utils/GetFormattedTime';
import { PostDeployHook } from '../deploy/PostDeployHook';
import * as rimraf from 'rimraf';
import ProjectConfig from '@dxatscale/sfpowerscripts.core/lib/project/ProjectConfig';
import InstallUnlockedPackageCollection from '@dxatscale/sfpowerscripts.core/lib/package/packageInstallers/InstallUnlockedPackageCollection';
import ExternalPackage2DependencyResolver from '@dxatscale/sfpowerscripts.core/lib/package/dependencies/ExternalPackage2DependencyResolver';
import ExternalDependencyDisplayer from '@dxatscale/sfpowerscripts.core/lib/display/ExternalDependencyDisplayer';
import { PreDeployHook } from '../deploy/PreDeployHook';
import GroupConsoleLogs from '../../ui/GroupConsoleLogs';
import { COLON_MIDDLE_BORDER_TABLE } from '../../ui/TableConstants';
import ReleaseConfig from '../release/ReleaseConfig';
const Table = require('cli-table');

export enum ValidateAgainst {
    PROVIDED_ORG,
    PRECREATED_POOL,
}
export enum ValidationMode {
    INDIVIDUAL = 'individual',
    FAST_FEEDBACK = 'fastfeedback',
    THOROUGH = 'thorough',
    FASTFEEDBACK_LIMITED_BY_RELEASE_CONFIG = 'ff-release-config',
    THOROUGH_LIMITED_BY_RELEASE_CONFIG = 'thorough-release-config',
}

export interface ValidateProps {
    validateAgainst: ValidateAgainst;
    validationMode: ValidationMode;
    releaseConfigPath?: string;
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
    orgInfo?: boolean;
    disableSourcePackageOverride?: boolean;
    disableParallelTestExecution?: boolean;
}

export default class ValidateImpl implements PostDeployHook, PreDeployHook {
    private changedComponents: Component[];
    private logger = new ConsoleLogger();
    private orgAsSFPOrg: SFPOrg;

    constructor(private props: ValidateProps) {}

    public async exec(): Promise<ValidateResult> {
        rimraf.sync('artifacts');

        let deploymentResult: DeploymentResult;
        let scratchOrgUsername: string;
        try {
            if (this.props.validateAgainst === ValidateAgainst.PROVIDED_ORG) {
                scratchOrgUsername = this.props.targetOrg;
            } else if (this.props.validateAgainst === ValidateAgainst.PRECREATED_POOL) {
                if (process.env.SFPOWERSCRIPTS_DEBUG_PREFETCHED_SCRATCHORG)
                    scratchOrgUsername = process.env.SFPOWERSCRIPTS_DEBUG_PREFETCHED_SCRATCHORG;
                else scratchOrgUsername = await this.fetchScratchOrgFromPool(this.props.pools, this.props.orgInfo);
            } else throw new Error(`Unknown mode ${this.props.validateAgainst}`);

            //Create Org
            this.orgAsSFPOrg = await SFPOrg.create({ aliasOrUsername: scratchOrgUsername });
            const connToScratchOrg = this.orgAsSFPOrg.getConnection();

            //Fetch Artifacts in the org
            let packagesInstalledInOrgMappedToCommits: { [p: string]: string };
            if (this.props.validationMode != ValidationMode.INDIVIDUAL)
                packagesInstalledInOrgMappedToCommits = await this.fetchCommitsOfPackagesInstalledInOrg();

            //In individual mode, always build changed packages only especially for validateAgainstOrg
            if (this.props.validationMode == ValidationMode.INDIVIDUAL) this.props.diffcheck = true;

            let builtSfpPackages = await this.buildChangedSourcePackages(packagesInstalledInOrgMappedToCommits);
            deploymentResult = await this.deploySourcePackages(scratchOrgUsername);

            if (deploymentResult.failed.length > 0 || deploymentResult.error)
                throw new ValidateError('Validation failed', { deploymentResult });
            else {
                //Do dependency analysis
                await this.dependencyAnalysis(this.orgAsSFPOrg, deploymentResult);

                //Display impact analysis
                await this.impactAnalysis(connToScratchOrg);
            }
            return null; //TODO: Fix with actual object
        } catch (error) {
            if (error.message?.includes(`No changes detected in the packages to be built`)) {
                SFPLogger.log(
                    `WARNING: No changes detected in any of the packages, Validation is treated as a success`,
                    LoggerLevel.WARN
                );
                return;
            } else if (error instanceof ValidateError) SFPLogger.log(`Error: ${error}`, LoggerLevel.DEBUG);
            else SFPLogger.log(`Error: ${error}}`, LoggerLevel.ERROR);
            throw error;
        } finally {
            await this.handleScratchOrgStatus(scratchOrgUsername, deploymentResult, this.props.isDeleteScratchOrg);
        }
    }

    private async fetchCommitsOfPackagesInstalledInOrg() {
        let installedArtifacts = await this.orgAsSFPOrg.getInstalledArtifacts();
        if (installedArtifacts.length == 0) {
            SFPLogger.log(COLOR_ERROR('Failed to query org for Sfpowerscripts Artifacts'));
            SFPLogger.log(COLOR_KEY_MESSAGE('Building all packages'));
        }

        //Read artifacts installed in the org
        let packagesMappedToLastKnownCommitId: { [p: string]: string } = {};
        if (installedArtifacts != null) {
            packagesMappedToLastKnownCommitId = getPackagesToCommits(installedArtifacts);
            printArtifactVersions(this.orgAsSFPOrg, installedArtifacts);
        }
        return packagesMappedToLastKnownCommitId;

        function getPackagesToCommits(installedArtifacts: any): { [p: string]: string } {
            const packagesToCommits: { [p: string]: string } = {};

            // Construct map of artifact and associated commit Id
            installedArtifacts.forEach((artifact) => {
                packagesToCommits[artifact.Name] = artifact.CommitId__c;
                //Override for debugging purposes
                if (process.env.VALIDATE_OVERRIDE_PKG)
                    packagesToCommits[process.env.VALIDATE_OVERRIDE_PKG] = process.env.VALIDATE_PKG_COMMIT_ID;
            });

            if (process.env.VALIDATE_REMOVE_PKG) delete packagesToCommits[process.env.VALIDATE_REMOVE_PKG];

            return packagesToCommits;
        }

        function printArtifactVersions(orgAsSFPOrg: SFPOrg, installedArtifacts: any) {
            let groupSection = new GroupConsoleLogs(
                `Artifacts installed in the Org ${orgAsSFPOrg.getUsername()}`
            ).begin();

            InstalledArtifactsDisplayer.printInstalledArtifacts(installedArtifacts, null);

            groupSection.end();
        }
    }

    private async dependencyAnalysis(orgAsSFPOrg: SFPOrg, deploymentResult: DeploymentResult) {
        if (this.props.isDependencyAnalysis) {
            let groupSection = new GroupConsoleLogs(`Validate Dependency tree`).begin();
            SFPLogger.log(
                COLOR_HEADER(
                    `-------------------------------------------------------------------------------------------`
                )
            );
            SFPLogger.log(COLOR_KEY_MESSAGE('Validating dependency  tree of changed components..'), LoggerLevel.INFO);
            const changedComponents = await this.getChangedComponents();
            const dependencyAnalysis = new DependencyAnalysis(orgAsSFPOrg, changedComponents);

            const dependencyViolations = await dependencyAnalysis.exec();

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
            groupSection.end();
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
                SFPLogger.log(err.message);
                SFPLogger.log('Failed to perform impact analysis');
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

    private async installPackageDependencies(
        sfdxProjectConfig: any,
        scratchOrgAsSFPOrg: SFPOrg,
        sfpPackage: SfpPackage,
        deployedPackages?: SfpPackage[]
    ) {
        let deployedPackagesAsStringArray: Array<string> = [];
        for (const deployedPackage of deployedPackages) {
            deployedPackagesAsStringArray.push(deployedPackage.package_name);
        }

        //Resolve external package dependencies
        let externalPackageResolver = new ExternalPackage2DependencyResolver(
            this.props.hubOrg.getConnection(),
            sfdxProjectConfig,
            this.props.keys
        );
        let externalPackage2s = await externalPackageResolver.resolveExternalPackage2DependenciesToVersions(
            [sfpPackage.packageName],
            deployedPackagesAsStringArray
        );

        SFPLogger.log(
            `Installing package dependencies of this ${sfpPackage.packageName} in ${scratchOrgAsSFPOrg.getUsername()}`,
            LoggerLevel.INFO,
            new ConsoleLogger()
        );
        //Display resolved dependenencies
        let externalDependencyDisplayer = new ExternalDependencyDisplayer(externalPackage2s, new ConsoleLogger());
        externalDependencyDisplayer.display();

        let packageCollectionInstaller = new InstallUnlockedPackageCollection(scratchOrgAsSFPOrg, new ConsoleLogger());
        await packageCollectionInstaller.install(externalPackage2s, true, true);

        SFPLogger.log(
            COLOR_KEY_MESSAGE(
                `Successfully completed external dependencies of this ${
                    sfpPackage.packageName
                } in ${scratchOrgAsSFPOrg.getUsername()}`
            )
        );
    }

    private async handleScratchOrgStatus(
        scratchOrgUsername: string,
        deploymentResult: DeploymentResult,
        isToDelete: boolean
    ) {
        //No scratch org available.. just return
        if (scratchOrgUsername == undefined) return;

        if (isToDelete) {
            //If deploymentResult is not available, or there is 0 packages deployed, we can reuse the org
            if (!deploymentResult || deploymentResult.deployed.length == 0) {
                SFPLogger.log(`Attempting to return scratch org ${scratchOrgUsername} back to pool`, LoggerLevel.INFO);
                const scratchOrgInfoAssigner = new ScratchOrgInfoAssigner(this.props.hubOrg);
                try {
                    const result = await scratchOrgInfoAssigner.setScratchOrgStatus(scratchOrgUsername, 'Return');
                    if (result)
                        SFPLogger.log(`Succesfully returned ${scratchOrgUsername} back to pool`, LoggerLevel.INFO);
                    else
                        SFPLogger.log(
                            COLOR_WARNING(
                                `Unable to return scratch org to pool, Please check permissions or update sfpower-pool-package to latest`
                            )
                        );
                } catch (error) {
                    SFPLogger.log(
                        COLOR_WARNING(
                            `Unable to return scratch org to pool, Please check permissions or update sfpower-pool-package to latest`
                        )
                    );
                }
            } else {
                try {
                    if (scratchOrgUsername && this.props.hubOrg.getUsername()) {
                        await deleteScratchOrg(this.props.hubOrg, scratchOrgUsername);
                    }
                } catch (error) {
                    SFPLogger.log(COLOR_WARNING(error.message));
                }
            }
        }
        async function deleteScratchOrg(hubOrg: Org, scratchOrgUsername: string) {
            SFPLogger.log(`Deleting scratch org ${scratchOrgUsername}`, LoggerLevel.INFO);
            const poolOrgDeleteImpl = new PoolOrgDeleteImpl(hubOrg, scratchOrgUsername);
            await poolOrgDeleteImpl.execute();
        }
    }

    private async deploySourcePackages(scratchOrgUsername: string): Promise<DeploymentResult> {
        const deployStartTime: number = Date.now();

        const deployProps: DeployProps = {
            targetUsername: scratchOrgUsername,
            artifactDir: 'artifacts',
            waitTime: 120,
            deploymentMode:
                this.props.disableSourcePackageOverride == true ? DeploymentMode.NORMAL : DeploymentMode.SOURCEPACKAGES,
            isTestsToBeTriggered: true,
            skipIfPackageInstalled: false,
            logsGroupSymbol: this.props.logsGroupSymbol,
            currentStage: Stage.VALIDATE,
            disableArtifactCommit: this.props.disableArtifactCommit,
            selectiveComponentDeployment:
                this.props.validationMode == ValidationMode.FAST_FEEDBACK ||
                this.props.validationMode == ValidationMode.FASTFEEDBACK_LIMITED_BY_RELEASE_CONFIG,
        };

        const deployImpl: DeployImpl = new DeployImpl(deployProps);
        deployImpl.postDeployHook = this;
        deployImpl.preDeployHook = this;

        const deploymentResult = await deployImpl.exec();

        const deploymentElapsedTime: number = Date.now() - deployStartTime;
        printDeploySummary(deploymentResult, deploymentElapsedTime);

        return deploymentResult;

        function printDeploySummary(deploymentResult: DeploymentResult, totalElapsedTime: number): void {
            let groupSection = new GroupConsoleLogs(`Deployment Summary`).begin();

            SFPLogger.log(
                COLOR_HEADER(
                    `----------------------------------------------------------------------------------------------------`
                )
            );
            SFPLogger.log(
                COLOR_SUCCESS(
                    `${deploymentResult.deployed.length} packages deployed in ${COLOR_TIME(
                        getFormattedTime(totalElapsedTime)
                    )} with {${COLOR_ERROR(deploymentResult.failed.length)}} failed deployments`
                )
            );

            if (deploymentResult.failed.length > 0) {
                SFPLogger.log(
                    COLOR_ERROR(
                        `\nPackages Failed to Deploy`,
                        deploymentResult.failed.map((packageInfo) => packageInfo.sfpPackage.packageName)
                    )
                );
            }

            SFPLogger.log(
                COLOR_HEADER(
                    `----------------------------------------------------------------------------------------------------`
                )
            );
            groupSection.end();
        }
    }

    private async buildChangedSourcePackages(packagesInstalledInOrgMappedToCommits: {
        [p: string]: string;
    }): Promise<SfpPackage[]> {
        let groupSection = new GroupConsoleLogs('Building Packages').begin();

        const buildStartTime: number = Date.now();

        const buildProps: BuildProps = {
            buildNumber: 1,
            executorcount: 10,
            waitTime: 120,
            isDiffCheckEnabled: this.props.diffcheck,
            isQuickBuild: true,
            isBuildAllAsSourcePackages: !this.props.disableSourcePackageOverride,
            currentStage: Stage.VALIDATE,
            baseBranch: this.props.baseBranch,
            devhubAlias: this.props.hubOrg?.getUsername(),
        };

        //Build DiffOptions
        const diffOptions: PackageDiffOptions = buildDiffOption(this.props);
        buildProps.diffOptions = diffOptions;

        //Compute packages to be included
        buildProps.includeOnlyPackages =  fetchPackagesAsPerReleaseConfig(this.logger,this.props);
        if (buildProps.includeOnlyPackages) {
            printIncludeOnlyPackages(buildProps.includeOnlyPackages);
        }

        const buildImpl: BuildImpl = new BuildImpl(buildProps);
        const { generatedPackages, failedPackages } = await buildImpl.exec();

        if (failedPackages.length > 0) throw new Error(`Failed to create source packages ${failedPackages}`);

        if (generatedPackages.length === 0) {
            throw new Error(
                `No changes detected in the packages to be built\nvalidate will only execute if there is a change in atleast one of the packages`
            );
        }

        for (const generatedPackage of generatedPackages) {
            try {
                await ArtifactGenerator.generateArtifact(generatedPackage, process.cwd(), 'artifacts');
            } catch (error) {
                SFPLogger.log(COLOR_ERROR(`Unable to create artifact for ${generatedPackage.packageName}`));
                throw error;
            }
        }
        const buildElapsedTime: number = Date.now() - buildStartTime;

        printBuildSummary(generatedPackages, failedPackages, buildElapsedTime);

        groupSection.end();

        return generatedPackages;

        function fetchPackagesAsPerReleaseConfig(logger:Logger,props: ValidateProps) {
            if (
                props.validationMode == ValidationMode.FASTFEEDBACK_LIMITED_BY_RELEASE_CONFIG ||
                props.validationMode == ValidationMode.THOROUGH_LIMITED_BY_RELEASE_CONFIG
            ) {
               
                let releaseConfig:ReleaseConfig = new ReleaseConfig(logger, props.releaseConfigPath);
                return releaseConfig.getPackagesAsPerReleaseConfig();
            }
        }

        //generate diff Option
        function buildDiffOption(props: ValidateProps) {
            const diffOptions: PackageDiffOptions = new PackageDiffOptions();
            //In fast feedback ignore package descriptor changes
            if (props.validationMode == ValidationMode.FAST_FEEDBACK) {
                diffOptions.skipPackageDescriptorChange = true;
                diffOptions.useLatestGitTags = false;
                diffOptions.packagesMappedToLastKnownCommitId = packagesInstalledInOrgMappedToCommits;
            } else if (props.validationMode == ValidationMode.THOROUGH) {
                diffOptions.skipPackageDescriptorChange = false;
                diffOptions.useLatestGitTags = false;
                diffOptions.packagesMappedToLastKnownCommitId = packagesInstalledInOrgMappedToCommits;
            } else if (props.validationMode == ValidationMode.INDIVIDUAL) {
                diffOptions.skipPackageDescriptorChange = false;
                //Dont send whats installed in orgs, use only the changed package from last know git tags
                diffOptions.useLatestGitTags = true;
                diffOptions.packagesMappedToLastKnownCommitId = null;
            } else if (props.validationMode == ValidationMode.THOROUGH_LIMITED_BY_RELEASE_CONFIG) {
                diffOptions.skipPackageDescriptorChange = false;
                diffOptions.useLatestGitTags = false;
                diffOptions.packagesMappedToLastKnownCommitId = packagesInstalledInOrgMappedToCommits;
            } else if (props.validationMode == ValidationMode.FASTFEEDBACK_LIMITED_BY_RELEASE_CONFIG) {
                diffOptions.skipPackageDescriptorChange = true;
                diffOptions.useLatestGitTags = false;
                diffOptions.packagesMappedToLastKnownCommitId = packagesInstalledInOrgMappedToCommits;
            }
            return diffOptions;
        }

        function printBuildSummary(
            generatedPackages: SfpPackage[],
            failedPackages: string[],
            totalElapsedTime: number
        ): void {
            SFPLogger.log(
                COLOR_HEADER(
                    `----------------------------------------------------------------------------------------------------`
                )
            );
            SFPLogger.log(
                COLOR_SUCCESS(
                    `${generatedPackages.length} packages created in ${COLOR_TIME(
                        getFormattedTime(totalElapsedTime)
                    )} with {${COLOR_ERROR(failedPackages.length)}} errors`
                )
            );

            if (failedPackages.length > 0) {
                SFPLogger.log(COLOR_ERROR(`Packages Failed To Build`, failedPackages));
            }
            SFPLogger.log(
                COLOR_HEADER(
                    `----------------------------------------------------------------------------------------------------`
                )
            );
        }

        function printIncludeOnlyPackages(includeOnlyPackages: string[]) {
            SFPLogger.log(
                COLOR_KEY_MESSAGE(`Build will include the below packages as per inclusive filter`),
                LoggerLevel.INFO
            );
            SFPLogger.log(COLOR_KEY_VALUE(`${includeOnlyPackages.toString()}`), LoggerLevel.INFO);
        }
    }

    private async fetchScratchOrgFromPool(pools: string[], displayOrgInfo?: boolean): Promise<string> {
        let scratchOrgUsername: string;

        for (const pool of pools) {
            let scratchOrg: ScratchOrg;
            try {
                const poolFetchImpl = new PoolFetchImpl(this.props.hubOrg, pool.trim(), false, true);
                scratchOrg = (await poolFetchImpl.execute()) as ScratchOrg;
            } catch (error) {
                SFPLogger.log(error.message, LoggerLevel.TRACE);
            }
            if (scratchOrg && scratchOrg.status === 'Assigned') {
                scratchOrgUsername = scratchOrg.username;
                SFPLogger.log(
                    COLOR_KEY_MESSAGE(`Fetched scratch org ${scratchOrgUsername} from ${COLOR_KEY_VALUE(pool)}`),
                    LoggerLevel.INFO,
                    this.logger
                );

                if (displayOrgInfo) printOrgInfo(scratchOrg);

                this.getCurrentRemainingNumberOfOrgsInPoolAndReport(scratchOrg.tag);
                break;
            }
        }

        if (scratchOrgUsername) return scratchOrgUsername;
        else
            throw new Error(
                `Failed to fetch scratch org from ${pools}, Are you sure you created this pool using a DevHub authenticated using auth:sfdxurl or auth:web or auth:accesstoken:store`
            );

        function printOrgInfo(scratchOrg: ScratchOrg): void {
            let groupSection = new GroupConsoleLogs(`Display Org Info`).begin();

            SFPLogger.log(
                COLOR_HEADER(
                    `----------------------------------------------------------------------------------------------`
                )
            );
            SFPLogger.log(COLOR_KEY_VALUE(`-- Org Details:--`));
            const table = new Table({
                chars: COLON_MIDDLE_BORDER_TABLE,
                style: { 'padding-left': 2 },
            });
            table.push([COLOR_HEADER(`Org Id`), COLOR_KEY_MESSAGE(scratchOrg.orgId)]);
            table.push([COLOR_HEADER(`Instance URL`), COLOR_KEY_MESSAGE(scratchOrg.instanceURL)]);
            table.push([COLOR_HEADER(`Username`), COLOR_KEY_MESSAGE(scratchOrg.username)]);
            table.push([COLOR_HEADER(`Password`), COLOR_KEY_MESSAGE(scratchOrg.password)]);
            table.push([COLOR_HEADER(`Auth URL`), COLOR_KEY_MESSAGE(scratchOrg.sfdxAuthUrl)]);
            table.push([COLOR_HEADER(`Expiry`), COLOR_KEY_MESSAGE(scratchOrg.expiryDate)]);
            SFPLogger.log(table.toString(), LoggerLevel.INFO);

            SFPLogger.log(
                COLOR_TRACE(`You may use the following commands to authenticate to the org`),
                LoggerLevel.INFO
            );
            SFPLogger.log(COLOR_TRACE(`cat ${scratchOrg.sfdxAuthUrl} > ./authfile`), LoggerLevel.INFO);
            SFPLogger.log(COLOR_TRACE(`sfdx auth sfdxurl store  --sfdxurlfile authfile`), LoggerLevel.INFO);
            SFPLogger.log(COLOR_TRACE(`sfdx force org open  --u ${scratchOrg.username}`), LoggerLevel.INFO);

            SFPLogger.log(
                COLOR_HEADER(
                    `----------------------------------------------------------------------------------------------`
                )
            );

            groupSection.end();
        }
    }

    private async getCurrentRemainingNumberOfOrgsInPoolAndReport(tag: string) {
        try {
            const results = await new ScratchOrgInfoFetcher(this.props.hubOrg).getScratchOrgsByTag(tag, false, true);

            const availableSo = results.records.filter((soInfo) => soInfo.Allocation_status__c === 'Available');

            SFPStatsSender.logGauge('pool.available', availableSo.length, {
                poolName: tag,
            });
        } catch (error) {
            //do nothing, we are not reporting anything if anything goes wrong here
        }
    }

    async preDeployPackage(
        sfpPackage: SfpPackage,
        targetUsername: string,
        deployedPackages?: SfpPackage[],
        devhubUserName?: string
    ): Promise<{ isToFailDeployment: boolean; message?: string }> {
        //Its a scratch org fetched from pool.. install dependencies
        //Assume hubOrg will be available, no need to check
        switch (this.props.validateAgainst) {
            case ValidateAgainst.PRECREATED_POOL:
                if (
                    this.props.validationMode == ValidationMode.THOROUGH ||
                    this.props.validationMode == ValidationMode.THOROUGH_LIMITED_BY_RELEASE_CONFIG
                ) {
                    await this.installPackageDependencies(
                        ProjectConfig.getSFDXProjectConfig(null),
                        this.orgAsSFPOrg,
                        sfpPackage,
                        deployedPackages
                    );
                } else if (this.props.validationMode == ValidationMode.INDIVIDUAL) {
                    await this.installPackageDependencies(
                        ProjectConfig.cleanupMPDFromProjectDirectory(null, sfpPackage.package_name),
                        this.orgAsSFPOrg,
                        sfpPackage,
                        deployedPackages
                    );
                }
                break;
            case ValidateAgainst.PROVIDED_ORG:
                if (this.props.validationMode == ValidationMode.INDIVIDUAL) {
                    if (this.props.hubOrg)
                        await this.installPackageDependencies(
                            ProjectConfig.cleanupMPDFromProjectDirectory(null, sfpPackage.package_name),
                            this.orgAsSFPOrg,
                            sfpPackage,
                            deployedPackages
                        );
                    else
                        SFPLogger.log(
                            `${COLOR_WARNING(
                                `DevHub was not provided, will skip installing /updating external dependencies of this package`
                            )}`,
                            LoggerLevel.INFO
                        );
                }
        }

        return { isToFailDeployment: false };
    }

    async postDeployPackage(
        sfpPackage: SfpPackage,
        packageInstallationResult: PackageInstallationResult,
        targetUsername: string,
        deployedPackages?: SfpPackage[],
        devhubUserName?: string
    ): Promise<{ isToFailDeployment: boolean; message?: string }> {
        //Trigger Tests after installation of each package
        if (sfpPackage.packageType && sfpPackage.packageType != PackageType.Data) {
            if (packageInstallationResult.result === PackageInstallationStatus.Succeeded) {
                //Get Changed Components
                const testResult = await this.triggerApexTests(sfpPackage, targetUsername, this.props, this.logger);
                return { isToFailDeployment: !testResult.result, message: testResult.message };
            }
        }
        return { isToFailDeployment: false };
    }

    private async triggerApexTests(
        sfpPackage: SfpPackage,
        targetUsername: string,
        props: ValidateProps,
        logger: Logger
    ): Promise<{
        id: string;
        result: boolean;
        message: string;
    }> {
        if (sfpPackage.packageDescriptor.skipTesting) return { id: null, result: true, message: 'No Tests To Run' };

        if (!sfpPackage.isApexFound) return { id: null, result: true, message: 'No Tests To Run' };

        if (sfpPackage.packageDescriptor.isOptimizedDeployment == false)
            return { id: null, result: true, message: 'Tests would have already run' };

        let testOptions: TestOptions, testCoverageOptions: CoverageOptions;

        if (
            props.validationMode == ValidationMode.FAST_FEEDBACK ||
            props.validationMode == ValidationMode.FASTFEEDBACK_LIMITED_BY_RELEASE_CONFIG
        ) {
            ({ testOptions, testCoverageOptions } = getTestOptionsForFastFeedBackPackage(sfpPackage, props));
        } else {
            ({ testOptions, testCoverageOptions } = getTestOptionsForFullPackageTest(sfpPackage, props));
        }
        if (testOptions == undefined) {
            return { id: null, result: true, message: 'No Tests To Run' };
        }

        //override any behaviour if the override is from the deploy props
        if(this.props.disableParallelTestExecution)
            testOptions.synchronous = true;

        displayTestHeader(sfpPackage);

        const triggerApexTests: TriggerApexTests = new TriggerApexTests(
            targetUsername,
            testOptions,
            testCoverageOptions,
            null,
            logger
        );

        return triggerApexTests.exec();

        function getTestOptionsForFullPackageTest(
            sfpPackage: SfpPackage,
            props: ValidateProps
        ): { testOptions: TestOptions; testCoverageOptions: CoverageOptions } {
            const testOptions = new RunAllTestsInPackageOptions(sfpPackage, 60, '.testresults');
            const testCoverageOptions = {
                isIndividualClassCoverageToBeValidated: false,
                isPackageCoverageToBeValidated: !sfpPackage.packageDescriptor.skipCoverageValidation,
                coverageThreshold: props.coverageThreshold || 75,
            };
            return { testOptions, testCoverageOptions };
        }

        function getTestOptionsForFastFeedBackPackage(
            sfpPackage: SfpPackage,
            props: ValidateProps
        ): { testOptions: TestOptions; testCoverageOptions: CoverageOptions } {
            //Change in security model trigger full

            if (sfpPackage.diffPackageMetadata) {
                if (
                    sfpPackage.diffPackageMetadata.isProfilesFound ||
                    sfpPackage.diffPackageMetadata.isPermissionSetFound ||
                    sfpPackage.diffPackageMetadata.isPermissionSetGroupFound
                ) {
                    SFPLogger.log(`${COLOR_HEADER('Change in security model, all test classses will be triggered')}`);
                    return getTestOptionsForFullPackageTest(sfpPackage, props);
                }

                const impactedTestClasses = sfpPackage.diffPackageMetadata.invalidatedTestClasses;

                //No impacted test class available
                if (!impactedTestClasses || impactedTestClasses.length == 0) {
                    SFPLogger.log(
                        `${COLOR_HEADER(
                            'Unable to find any impacted test classses,skipping tests, You might need to use thorough option'
                        )}`
                    );
                    return { testOptions: undefined, testCoverageOptions: undefined };
                }

                SFPLogger.log(
                    `${COLOR_HEADER('Fast Feedback Mode activated, Only impacted test class will be triggered')}`
                );

                const testOptions = new RunSpecifiedTestsOption(
                    60,
                    '.testResults',
                    impactedTestClasses.join(),
                    sfpPackage.packageDescriptor.testSynchronous
                );
                const testCoverageOptions = {
                    isIndividualClassCoverageToBeValidated: false,
                    isPackageCoverageToBeValidated: false,
                    coverageThreshold: 0,
                };
                return { testOptions, testCoverageOptions };
            } else {
                SFPLogger.log(
                    `${COLOR_HEADER(
                        'Selective components were not found to compute invalidated test class, skipping tests'
                    )}`
                );
                SFPLogger.log(`${COLOR_HEADER('Please use thorough mode on this package, if its new')}`);
                return { testOptions: undefined, testCoverageOptions: undefined };
            }
        }

        function displayTestHeader(sfpPackage: SfpPackage) {
            SFPLogger.log(
                COLOR_HEADER(
                    `-------------------------------------------------------------------------------------------`
                )
            );
            SFPLogger.log(`Triggering Apex tests for ${sfpPackage.packageName}`, LoggerLevel.INFO);
            SFPLogger.log(
                COLOR_HEADER(
                    `-------------------------------------------------------------------------------------------`
                )
            );
        }
    }
}
