import ReleaseDefinitionSchema from './ReleaseDefinitionSchema';
import DeployImpl, { DeployProps, DeploymentMode, DeploymentResult } from '../deploy/DeployImpl';
import SFPLogger, { COLOR_HEADER, COLOR_KEY_MESSAGE, ConsoleLogger, Logger, LoggerLevel } from '@dxatscale/sfp-logger';
import { Stage } from '../Stage';
import ReleaseError from '../../errors/ReleaseError';
import ChangelogImpl from '../../impl/changelog/ChangelogImpl';
import SFPStatsSender from '@dxatscale/sfpowerscripts.core/lib/stats/SFPStatsSender';
import { Release } from '../changelog/ReleaseChangelog';
import SFPOrg from '@dxatscale/sfpowerscripts.core/lib/org/SFPOrg';
import path = require('path');
import { EOL } from 'os';
import Package2Detail from '@dxatscale/sfpowerscripts.core/lib/package/Package2Detail';
import InstallUnlockedPackageCollection from '@dxatscale/sfpowerscripts.core/lib/package/packageInstallers/InstallUnlockedPackageCollection';
import FetchImpl from '../artifacts/FetchImpl';
import GroupConsoleLogs  from '../../ui/GroupConsoleLogs';
import { ReleaseStreamService } from '@dxatscale/sfpowerscripts.core/lib/eventStream/release';

export interface ReleaseProps {
    releaseDefinitions: ReleaseDefinitionSchema[];
    targetOrg: string;
    fetchArtifactScript: string;
    isNpm: boolean;
    scope: string;
    npmrcPath: string;
    logsGroupSymbol: string[];
    tags: any;
    isDryRun: boolean;
    waitTime: number;
    keys: string;
    isGenerateChangelog: boolean;
    devhubUserName: string;
    branch: string;
    directory: string;
}

export default class ReleaseImpl {
    constructor(private props: ReleaseProps, private logger?: Logger) {}

    public async exec(): Promise<ReleaseResult> {
        let groupSection = new GroupConsoleLogs('Fetching artifacts').begin();
        let fetchImpl: FetchImpl = new FetchImpl(
            'artifacts',
            this.props.fetchArtifactScript,
            this.props.scope,
            this.props.npmrcPath,
            this.logger
        );
        await fetchImpl.fetchArtifacts(this.props.releaseDefinitions);
        groupSection.end();

        let installDependenciesResult: InstallDependenciesResult;
        installDependenciesResult = await this.installPackageDependencies(
            this.props.releaseDefinitions,
            this.props.targetOrg,
            this.props.keys,
            this.props.waitTime
        );

        let deploymentResults = await this.deployArtifacts(this.props.releaseDefinitions);

        //Get all suceeded deploys
        let succeededDeploymentResults = [];
        let failedDeploymentResults = [];
        for (const deploymentResult of deploymentResults) {
            if (deploymentResult.result.failed.length === 0) succeededDeploymentResults.push(deploymentResult);
            else failedDeploymentResults.push(deploymentResult);
        }

        //Compute Changelog

        //There is atleast one succeeded result, so changelog is required
        if (succeededDeploymentResults.length > 0) {
            //ReleaseName combines all the release together .. even if failed
            //Combine all release defns to create release attributes
            let releaseName: string = '';
            let workitemFilters = [];
            let limit = 30;
            let workItemUrl: string;
            let showAllArtifacts: boolean = false;
            for (const releaseDefinition of this.props.releaseDefinitions) {
                releaseName = releaseName.concat(releaseDefinition.release, '-');
                if (releaseDefinition.changelog) {
                    workitemFilters.push(releaseDefinition.changelog?.workItemFilters);
                    if (releaseDefinition.changelog.limit > limit) limit = releaseDefinition.changelog.limit;
                    workItemUrl = releaseDefinition.changelog.workItemUrl;
                    showAllArtifacts = releaseDefinition.changelog.showAllArtifacts;
                }
            }
            //Remove the last '-' from the name
            releaseName = releaseName.slice(0, -1);
            if (this.props.isGenerateChangelog) {
                let groupSection = new GroupConsoleLogs('Release changelog').begin();
                try {
                    let changelogImpl: ChangelogImpl = new ChangelogImpl(
                        this.logger,
                        'artifacts',
                        releaseName,
                        workitemFilters,
                        limit,
                        workItemUrl,
                        showAllArtifacts,
                        this.props.directory,
                        false,
                        this.props.branch,
                        false,
                        this.props.isDryRun,
                        this.props.targetOrg
                    );

                    let releaseChangelog = await changelogImpl.exec();

                    const aggregatedNumberOfWorkItemsInRelease = this.getAggregatedNumberOfWorkItemsInRelease(
                        releaseName,
                        releaseChangelog.releases
                    );

                    SFPStatsSender.logGauge('release.workitems', aggregatedNumberOfWorkItemsInRelease, {
                        releaseName: releaseName,
                    });

                    const aggregatedNumberOfCommitsInRelease = this.getAggregatedNumberOfCommitsInRelease(
                        releaseName,
                        releaseChangelog.releases
                    );

                    SFPStatsSender.logGauge('release.commits', aggregatedNumberOfCommitsInRelease, {
                        releaseName: releaseName,
                    });
                } catch (error) {
                    SFPLogger.log(`Unable to push changelog`, LoggerLevel.WARN, this.logger);
                }

                groupSection.end();
            }
        }

        if (failedDeploymentResults.length > 0) {
            throw new ReleaseError('Release  failed', {
                succeededDeployments: succeededDeploymentResults,
                failedDeployments: failedDeploymentResults,
                installDependenciesResult: installDependenciesResult,
            });
        }

        return {
            succeededDeployments: succeededDeploymentResults,
            failedDeployments: failedDeploymentResults,
            installDependenciesResult: installDependenciesResult,
        };
    }

    /**
     *
     * @param releases
     * @returns aggregated number of work items in a release
     */
    private getAggregatedNumberOfWorkItemsInRelease(releaseName: string, releases: Release[]) {
        let aggregatedNumberOfWorkItemsInRelease: number = 0;
        releases.forEach((release) => {
            if (release.names?.includes(releaseName)) {
                aggregatedNumberOfWorkItemsInRelease += this.getNumberOfWorkItems(release);
            }
        });
        return aggregatedNumberOfWorkItemsInRelease;
    }

    /**
     *
     * @param releases
     * @returns aggregated number of commits in a release
     */
    private getAggregatedNumberOfCommitsInRelease(releaseName: string, releases: Release[]) {
        let aggregatedNumberOfCommitsInRelease: number = 0;
        releases.forEach((release) => {
            if (release.names?.includes(releaseName)) {
                aggregatedNumberOfCommitsInRelease += this.getNumberOfCommits(release);
            }
        });
        return aggregatedNumberOfCommitsInRelease;
    }

    private getNumberOfWorkItems(release: Release) {
        return Object.keys(release.workItems).length;
    }

    private getNumberOfCommits(release: Release) {
        let numberOfCommits: number = 0;

        release.artifacts.forEach((artifact) => {
            numberOfCommits += artifact.commits.length;
        });

        return numberOfCommits;
    }

    private async deployArtifacts(
        releaseDefinitions: ReleaseDefinitionSchema[]
    ): Promise<{ releaseDefinition: ReleaseDefinitionSchema; result: DeploymentResult }[]> {
        let deploymentResults: { releaseDefinition: ReleaseDefinitionSchema; result: DeploymentResult }[] = [];
        for (const releaseDefinition of releaseDefinitions) {
            let groupSection = new GroupConsoleLogs(`Release ${releaseDefinition.release}`).begin();
            SFPLogger.log(EOL);

            this.displayReleaseInfo(releaseDefinition, this.props);

            //Each release will be downloaded to specific subfolder inside the provided artifact directory
            //As each release is a collection of artifacts
            let revisedArtifactDirectory = path.join(
                'artifacts',
                releaseDefinition.release.replace(/[/\\?%*:|"<>]/g, '-')
            );
            let deployProps: DeployProps = {
                targetUsername: this.props.targetOrg,
                artifactDir: revisedArtifactDirectory,
                waitTime: this.props.waitTime,
                tags: this.props.tags,
                isTestsToBeTriggered: false,
                deploymentMode: DeploymentMode.NORMAL,
                skipIfPackageInstalled: releaseDefinition.skipIfAlreadyInstalled,
                logsGroupSymbol: this.props.logsGroupSymbol,
                currentStage: Stage.DEPLOY,
                baselineOrg: releaseDefinition.baselineOrg,
                isDryRun: this.props.isDryRun,
                disableArtifactCommit: releaseDefinition.skipArtifactUpdate?releaseDefinition.skipArtifactUpdate:false,
                promotePackagesBeforeDeploymentToOrg: releaseDefinition.promotePackagesBeforeDeploymentToOrg,
                devhubUserName: this.props.devhubUserName,
            };

            let deployImpl: DeployImpl = new DeployImpl(deployProps);

            let deploymentResult = await deployImpl.exec();
            deploymentResults.push({ releaseDefinition: releaseDefinition, result: deploymentResult });
            groupSection.end();
            //Don't continue deployments if a release breaks in between
            if (deploymentResult.failed.length > 0) break;
        }

        return deploymentResults;
    }

    private async installPackageDependencies(
        releaseDefinitions: ReleaseDefinitionSchema[],
        targetOrg: string,
        keys: string,
        waitTime: number
    ): Promise<InstallDependenciesResult> {
        let result: InstallDependenciesResult = {
            success: [],
            skipped: [],
            failed: [],
        };

        let packageDependencies: { [p: string]: string } = {};

        releaseDefinitions.forEach((releaseDefinition) => {
            if (releaseDefinition.packageDependencies) {
                packageDependencies = Object.assign(packageDependencies, releaseDefinition.packageDependencies);
            }
        });

        let groupSection = new GroupConsoleLogs('Installing package dependencies').begin();

        try {
            let packagesToKeys: { [p: string]: string };
            if (keys) {
                packagesToKeys = this.parseKeys(keys);
            }
            let externalPackage2s: Package2Detail[] = [];
            // print packages dependencies to install
            for (let pkg in packageDependencies) {
                let dependendentPackage: Package2Detail = { name: pkg };
                if (packageDependencies[pkg].startsWith('04t'))
                    dependendentPackage.subscriberPackageVersionId = packageDependencies[pkg];

                if (packagesToKeys?.[pkg]) {
                    dependendentPackage.key = packagesToKeys[pkg];
                }
                externalPackage2s.push(dependendentPackage);
            }
            let sfpOrg = await SFPOrg.create({ aliasOrUsername: targetOrg });
            ReleaseStreamService.buildOrgInfo(sfpOrg.getConnection().getAuthInfoFields().instanceUrl);
            let packageCollectionInstaller = new InstallUnlockedPackageCollection(sfpOrg, new ConsoleLogger());
            await packageCollectionInstaller.install(externalPackage2s, true, true);

            groupSection.end();
            return result;
        } catch (err) {
            console.log(err.message);

            throw new ReleaseError(
                'Failed to install package dependencies',
                { installDependenciesResult: result, succeededDeployments: [], failedDeployments: [] },
                err
            );
        }
    }

    /**
     * Parse keys in string format "packageA:key packageB:key packageC:key"
     * Returns map of packages to keys
     * @param keys
     */
    private parseKeys(keys: string) {
        let output: { [p: string]: string } = {};

        keys = keys.trim();
        let listOfKeys = keys.split(' ');

        for (let key of listOfKeys) {
            let packageKeyPair = key.split(':');
            if (packageKeyPair.length === 2) {
                output[packageKeyPair[0]] = packageKeyPair[1];
            } else {
                // Format is incorrect, throw an error
                throw new Error(`Error parsing keys, format should be: "packageA:key packageB:key packageC:key"`);
            }
        }

        return output;
    }

    private displayReleaseInfo(releaseDefinition: ReleaseDefinitionSchema, props: ReleaseProps) {
        SFPLogger.log(
            COLOR_HEADER(`-------------------------------------------------------------------------------------------`)
        );

        SFPLogger.log(COLOR_KEY_MESSAGE(`Release: ${releaseDefinition.release}`));

        SFPLogger.log(
            COLOR_KEY_MESSAGE(
                `Skip Packages If Already Installed: ${releaseDefinition.skipIfAlreadyInstalled ? true : false}`
            )
        );

        if (releaseDefinition.baselineOrg)
            SFPLogger.log(COLOR_KEY_MESSAGE(`Baselined Against Org: ${releaseDefinition.baselineOrg}`));
        SFPLogger.log(COLOR_KEY_MESSAGE(`Dry-run: ${props.isDryRun}`));
        if (
            releaseDefinition.promotePackagesBeforeDeploymentToOrg &&
            releaseDefinition.promotePackagesBeforeDeploymentToOrg == props.targetOrg
        )
            SFPLogger.log(COLOR_KEY_MESSAGE(`Promte Packages Before Deployment Activated?: true`));

        SFPLogger.log(
            COLOR_HEADER(`-------------------------------------------------------------------------------------------`)
        );
    }
}

interface InstallDependenciesResult {
    success: [string, string][];
    skipped: [string, string][];
    failed: [string, string][];
}

export interface ReleaseResult {
    succeededDeployments: { releaseDefinition: ReleaseDefinitionSchema; result: DeploymentResult }[];
    failedDeployments: { releaseDefinition: ReleaseDefinitionSchema; result: DeploymentResult }[];
    installDependenciesResult: InstallDependenciesResult;
}
