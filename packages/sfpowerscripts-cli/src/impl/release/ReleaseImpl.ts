import ReleaseDefinitionSchema from './ReleaseDefinitionSchema';
import FetchImpl from '../artifacts/FetchImpl';
import DeployImpl, { DeployProps, DeploymentMode, DeploymentResult } from '../deploy/DeployImpl';
import SFPLogger, { COLOR_HEADER, COLOR_KEY_MESSAGE, Logger, LoggerLevel } from '@dxatscale/sfp-logger';
import { Stage } from '../Stage';
import child_process = require('child_process');
import ReleaseError from '../../errors/ReleaseError';
import ChangelogImpl from '../../impl/changelog/ChangelogImpl';
import SFPStatsSender from '@dxatscale/sfpowerscripts.core/lib/stats/SFPStatsSender';
import { Release } from '../changelog/ReleaseChangelogInterfaces';
import SFPOrg from '@dxatscale/sfpowerscripts.core/lib/org/SFPOrg';
import path = require('path');
import { EOL } from 'os';

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
    directory:string;
}

export default class ReleaseImpl {
    constructor(private props: ReleaseProps,private logger?:Logger) {}

    public async exec(): Promise<ReleaseResult> {
        this.printOpenLoggingGroup('Fetching artifacts');
        let fetchImpl: FetchImpl = new FetchImpl(
            this.props.releaseDefinitions,
            'artifacts',
            this.props.fetchArtifactScript,
            this.props.isNpm,
            this.props.scope,
            this.props.npmrcPath
        );
        await fetchImpl.exec();
        this.printClosingLoggingGroup();

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
                releaseName = releaseName.concat(releaseDefinition.release,'-')
                if (releaseDefinition.changelog) {
                    workitemFilters.push(releaseDefinition.changelog?.workItemFilters);
                    if (releaseDefinition.changelog.limit > limit) limit = releaseDefinition.changelog.limit;
                    workItemUrl = releaseDefinition.changelog.workItemUrl;
                    showAllArtifacts = releaseDefinition.changelog.showAllArtifacts;
                }
            }
           //Remove the last '-' from the name
            releaseName = releaseName.slice(0,-1);
            if (this.props.isGenerateChangelog) {
                this.printOpenLoggingGroup('Release changelog');

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

                this.printClosingLoggingGroup();
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
            if (release.names.includes(releaseName)) {
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
            if (release.names.includes(releaseName)) {
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
            this.printOpenLoggingGroup(`Release ${releaseDefinition.release}`);
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
                promotePackagesBeforeDeploymentToOrg: releaseDefinition.promotePackagesBeforeDeploymentToOrg,
                devhubUserName: this.props.devhubUserName,
            };

            let deployImpl: DeployImpl = new DeployImpl(deployProps);

            let deploymentResult = await deployImpl.exec();
            deploymentResults.push({ releaseDefinition: releaseDefinition, result: deploymentResult });
            this.printClosingLoggingGroup();
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

        this.printOpenLoggingGroup('Installing package dependencies');

        try {
            let packagesToKeys: { [p: string]: string };
            if (keys) {
                packagesToKeys = this.parseKeys(keys);
            }

            // print packages dependencies to install

            for (let pkg in packageDependencies) {
                if (!(await this.isPackageInstalledInOrg(packageDependencies[pkg], targetOrg))) {
                    if (this.props.isDryRun) {
                        SFPLogger.log(
                            `Package Dependency ${packageDependencies[pkg]} will be installed`,
                            LoggerLevel.INFO
                        );
                    } else {
                        let cmd = `sfdx force:package:install -p ${packageDependencies[pkg]} -u ${targetOrg} -w ${waitTime} -b ${waitTime} --noprompt`;

                        if (packagesToKeys?.[pkg]) cmd += ` -k ${packagesToKeys[pkg]}`;

                        SFPLogger.log(
                            `Installing package dependency ${pkg}: ${packageDependencies[pkg]}`,
                            LoggerLevel.INFO
                        );
                        child_process.execSync(cmd, {
                            stdio: 'inherit',
                        });
                        result.success.push([pkg, packageDependencies[pkg]]);
                    }
                } else {
                    result.skipped.push([pkg, packageDependencies[pkg]]);
                    SFPLogger.log(
                        `Package dependency ${pkg}: ${packageDependencies[pkg]} is already installed in target org`
                    );
                    continue;
                }
            }

            this.printClosingLoggingGroup();
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

    private async isPackageInstalledInOrg(packageVersionId: string, targetUsername: string): Promise<boolean> {
        try {
            let targetOrg = await SFPOrg.create({ aliasOrUsername: targetUsername });

            SFPLogger.log(`Checking Whether Package with ID ${packageVersionId} is installed in  ${targetUsername}`);
            let installedPackages = await targetOrg.getAllInstalled2GPPackages();

            let packageFound = installedPackages.find((installedPackage) => {
                return installedPackage.subscriberPackageVersionId === packageVersionId;
            });

            return packageFound ? true : false;
        } catch (error) {
            SFPLogger.log('Unable to check whether this package is installed in the target org');
            return false;
        }
    }

    private printOpenLoggingGroup(message: string) {
        if (this.props.logsGroupSymbol?.[0])
            SFPLogger.log(`${this.props.logsGroupSymbol[0]} ${message}`, LoggerLevel.INFO);
    }

    private printClosingLoggingGroup() {
        if (this.props.logsGroupSymbol?.[1]) SFPLogger.log(this.props.logsGroupSymbol[1], LoggerLevel.INFO);
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
