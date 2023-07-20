import { Org } from '@salesforce/core';
import { PoolConfig } from '@dxatscale/sfpowerscripts.core/lib/scratchorg/pool/PoolConfig';
import isValidSfdxAuthUrl from '@dxatscale/sfpowerscripts.core/lib/scratchorg/pool/prequisitecheck/IsValidSfdxAuthUrl';
import SFPLogger, { COLOR_KEY_MESSAGE, COLOR_WARNING, ConsoleLogger, Logger, LoggerLevel } from '@dxatscale/sfp-logger';
import ArtifactGenerator from '@dxatscale/sfpowerscripts.core/lib/artifacts/generators/ArtifactGenerator';
import ProjectConfig from '@dxatscale/sfpowerscripts.core/lib/project/ProjectConfig';
import { Result } from 'neverthrow';
import FetchAnArtifact from '../artifacts/FetchAnArtifact';
import FetchArtifactSelector from '../artifacts/FetchArtifactSelector';
import BuildImpl, { BuildProps } from '../parallelBuilder/BuildImpl';
import PoolCreateImpl from '@dxatscale/sfpowerscripts.core/lib/scratchorg/pool/PoolCreateImpl';
import { PoolError } from '@dxatscale/sfpowerscripts.core/lib/scratchorg/pool/PoolError';
import { Stage } from '../Stage';
import PrepareOrgJob from './PrepareOrgJob';
import * as rimraf from 'rimraf';
import * as fs from 'fs-extra';
import Git from '@dxatscale/sfpowerscripts.core/lib/git/Git';
import GitTags from '@dxatscale/sfpowerscripts.core/lib/git/GitTags';
import OrgDetailsFetcher from '@dxatscale/sfpowerscripts.core/lib/org/OrgDetailsFetcher';
import SFPOrg from '@dxatscale/sfpowerscripts.core/lib/org/SFPOrg';
import { EOL } from 'os';
import SFPStatsSender from '@dxatscale/sfpowerscripts.core/lib/stats/SFPStatsSender';
import ExternalPackage2DependencyResolver from '@dxatscale/sfpowerscripts.core/lib/package/dependencies/ExternalPackage2DependencyResolver';
import ExternalDependencyDisplayer from '@dxatscale/sfpowerscripts.core/lib/display/ExternalDependencyDisplayer';
import ReleaseDefinitionGenerator from '../release/ReleaseDefinitionGenerator';
import ReleaseDefinitionSchema from '../release/ReleaseDefinitionSchema';
import { ZERO_BORDER_TABLE } from '../../ui/TableConstants';
import GroupConsoleLogs from '../../ui/GroupConsoleLogs';
import ReleaseConfig from '../release/ReleaseConfig';
import { COLOR_KEY_VALUE } from '@dxatscale/sfp-logger';
import { PrepareStreamService } from '@dxatscale/sfpowerscripts.core/lib/eventStream/prepare';

const Table = require('cli-table');

export default class PrepareImpl {
    private artifactFetchedCount: number = 0;

    public constructor(private hubOrg: SFPOrg, private pool: PoolConfig, private logLevel: LoggerLevel) {
        // set defaults
        if (!this.pool.expiry) this.pool.expiry = 2;

        if (!this.pool.batchSize) this.pool.batchSize = 5;

        if (this.pool.succeedOnDeploymentErrors === undefined) this.pool.succeedOnDeploymentErrors = true;

        if (!this.pool.waitTime) this.pool.waitTime = 6;

        if (!this.pool.maxRetryCount) this.pool.maxRetryCount = 2;
    }

    public async exec() {
        SFPLogger.log(COLOR_KEY_MESSAGE('Validating Org Authentication Mechanism..'), LoggerLevel.INFO);
        let orgDisplayResult = await new OrgDetailsFetcher(this.hubOrg.getUsername()).getOrgDetails();

        if (!(orgDisplayResult.sfdxAuthUrl && isValidSfdxAuthUrl(orgDisplayResult.sfdxAuthUrl))) {
            PrepareStreamService.buildPoolError(
                0,
                0,
                `Pools have to be created using a DevHub authenticated with auth:web or auth:store or auth:accesstoken:store`,
                'failed'
            );
            throw new Error(
                `Pools have to be created using a DevHub authenticated with auth:web or auth:store or auth:accesstoken:store`
            );
        }
        return this.poolScratchOrgs();
    }

    private async poolScratchOrgs(): Promise<Result<PoolConfig, PoolError>> {
        //Create Artifact Directory
        rimraf.sync('artifacts');
        fs.mkdirpSync('artifacts');

        let restrictedPackages = null;
        let projectConfig = ProjectConfig.getSFDXProjectConfig(null);

        if (this.pool.releaseConfigFile) {
            restrictedPackages = await getArtifactsByGeneratingReleaseDefinitionFromConfig(this.pool.releaseConfigFile);
            PrepareStreamService.buildReleaseConfig(restrictedPackages);
            projectConfig = ProjectConfig.cleanupPackagesFromProjectDirectory(null, restrictedPackages);
        }

        if (this.pool.installAll) {
            await this.getPackageArtifacts(restrictedPackages);
        }

        let checkpointPackages = this.getcheckPointPackages(new ConsoleLogger(), projectConfig);

        let externalPackageResolver = new ExternalPackage2DependencyResolver(
            this.hubOrg.getConnection(),
            projectConfig,
            this.pool.keys
        );
        let externalPackage2s = await externalPackageResolver.resolveExternalPackage2DependenciesToVersions();

        //Display resolved dependencies
        let externalDependencyDisplayer = new ExternalDependencyDisplayer(externalPackage2s, new ConsoleLogger());
        externalDependencyDisplayer.display();

        let prepareASingleOrgImpl: PrepareOrgJob = new PrepareOrgJob(this.pool, checkpointPackages, externalPackage2s);

        let createPool: PoolCreateImpl = new PoolCreateImpl(
            this.hubOrg,
            this.pool,
            prepareASingleOrgImpl,
            this.logLevel
        );
        let pool = (await createPool.execute()) as Result<PoolConfig, PoolError>;

        if (pool.isOk()) {
            await this.displayPoolSummary(pool.value);
        }

        return pool;

        async function getArtifactsByGeneratingReleaseDefinitionFromConfig(releaseConfigFile: string) {
            let releaseDefinitionGenerator: ReleaseDefinitionGenerator = new ReleaseDefinitionGenerator(
                new ConsoleLogger(),
                'HEAD',
                releaseConfigFile,
                'prepare',
                'test',
                undefined,
                true,
                false,
                true
            );
            let releaseDefinition = (await releaseDefinitionGenerator.exec()) as ReleaseDefinitionSchema;
            return Object.keys(releaseDefinition.artifacts);
        }
    }

    //Fetch all checkpoints
    private getcheckPointPackages(projectConfig: any, logger: Logger) {
        SFPLogger.log('Fetching checkpoints for prepare if any.....', LoggerLevel.INFO, logger);

        let checkPointPackages = [];

        ProjectConfig.getAllPackageDirectoriesFromConfig(projectConfig).forEach((pkg) => {
            if (pkg.checkpointForPrepare) checkPointPackages.push(pkg['package']);
        });

        return checkPointPackages;
    }

    private async displayPoolSummary(pool: PoolConfig) {
        let table = new Table({
            head: [
                'Scratch Org Alias Id',
                'Scratch Org Username',
                'Installed/Requested Count',
                'Last Installed Package',
            ],
            chars: ZERO_BORDER_TABLE,
        });

        for (const scratchOrg of pool.scratchOrgs) {
            try {
                let scratchOrgAsSFPOrg = await SFPOrg.create({ aliasOrUsername: scratchOrg.username });
                let installedArtifacts = await scratchOrgAsSFPOrg.getInstalledArtifacts();
                if (installedArtifacts && installedArtifacts.length >= 1) {
                    let installationCount = installedArtifacts.length;
                    let lastInstalledArifact = installedArtifacts[installedArtifacts.length - 1];
                    table.push([
                        scratchOrg.alias,
                        scratchOrg.username,
                        `${installationCount}/${this.artifactFetchedCount}`,
                        lastInstalledArifact.Name,
                    ]);
                    SFPStatsSender.logGauge(`so.packages.requested`, this.artifactFetchedCount, {
                        pool: this.pool.tag,
                        scratchOrg: scratchOrg.alias,
                    });
                    SFPStatsSender.logGauge(`so.packages.installed`, installationCount, {
                        pool: this.pool.tag,
                        scratchOrg: scratchOrg.alias,
                    });
                } else {
                    table.push([scratchOrg.alias, scratchOrg.username, `NA`, `NA`]);
                    SFPStatsSender.logGauge(`so.packages.requested`, 0, {
                        pool: this.pool.tag,
                        scratchOrg: scratchOrg.alias,
                    });
                    SFPStatsSender.logGauge(`so.packages.installed`, 0, {
                        pool: this.pool.tag,
                        scratchOrg: scratchOrg.alias,
                    });
                }
            } catch (error) {
                SFPStatsSender.logGauge(`so.packages.requested`, 0, {
                    pool: this.pool.tag,
                    scratchOrg: scratchOrg.alias,
                });
                SFPStatsSender.logGauge(`so.packages.installed`, 0, {
                    pool: this.pool.tag,
                    scratchOrg: scratchOrg.alias,
                });
                table.push([scratchOrg.alias, scratchOrg.username, `Unable to compute`, `Unable to fetch`]);
            }
        }

        if (table.length >= 1) {
            SFPLogger.log(EOL, LoggerLevel.INFO);
            SFPLogger.log(COLOR_KEY_MESSAGE('Pool Summary:'), LoggerLevel.INFO);
            SFPLogger.log(table.toString(), LoggerLevel.INFO);
        }
    }

    private async getPackageArtifacts(restrictedPackages?: string[]) {
        //Filter Packages to be ignored from prepare to be fetched
        let packages = ProjectConfig.getAllPackageDirectoriesFromDirectory(null).filter((pkg) => {
            return isPkgToBeInstalled(pkg, restrictedPackages);
        });

        let artifactFetcher: FetchAnArtifact;
        if (this.pool.fetchArtifacts) {
            let fetchArtifactsLogGroup = new GroupConsoleLogs(`Fetching Artifacts`);
            fetchArtifactsLogGroup.begin();
            artifactFetcher = new FetchArtifactSelector(
                this.pool.fetchArtifacts.artifactFetchScript,
                this.pool.fetchArtifacts.npm?.scope,
                this.pool.fetchArtifacts.npm?.npmrcPath
            ).getArtifactFetcher();

            const git: Git = await Git.initiateRepo();

            //During Prepare, there could be a race condition where a main is merged with a new package
            //but the package is not yet available in the validated package list and can cause prepare to fail
            for (const pkg of packages) {
                try {
                    let latestGitTagVersion: GitTags = new GitTags(git, pkg.package);
                    let version = await latestGitTagVersion.getVersionFromLatestTag();
                    artifactFetcher.fetchArtifact(pkg.package, 'artifacts', version, true);
                    this.artifactFetchedCount++;
                } catch (error) {
                    SFPLogger.log(
                        COLOR_WARNING(`Git Tag for ${pkg.package} missing, This might result in deployment failures`)
                    );
                }
            }
            fetchArtifactsLogGroup.end();
        } else {
            let buildArtifactsLogGroup = new GroupConsoleLogs(`Building Artifacts`);
            buildArtifactsLogGroup.begin();
            //Build All Artifacts
            SFPLogger.log(`${EOL}`);
            SFPLogger.log(
                '-------------------------------------WARNING!!!!------------------------------------------------',
                LoggerLevel.WARN
            );
            SFPLogger.log('Building packages, as script to fetch artifacts was not provided', LoggerLevel.WARN);
            SFPLogger.log(
                'This is not ideal, as the artifacts are  built from the current head of the provided branch',
                LoggerLevel.WARN
            );
            SFPLogger.log('Pools should be prepared with previously validated packages', LoggerLevel.WARN);
            SFPLogger.log(
                '------------------------------------------------------------------------------------------------',
                LoggerLevel.WARN
            );

            let buildProps: BuildProps = {
                configFilePath: this.pool.configFilePath,
                devhubAlias: this.hubOrg.getUsername(),
                waitTime: 120,
                isQuickBuild: true,
                isDiffCheckEnabled: false,
                buildNumber: 1,
                executorcount: 10,
                isBuildAllAsSourcePackages: this.pool.disableSourcePackageOverride ? false : true,
                branch: null,
                currentStage: Stage.PREPARE,
            };

            buildProps = includeOnlyPackagesAsPerReleaseConfig(this.pool.releaseConfigFile, buildProps);

            let buildImpl = new BuildImpl(buildProps);
            let { generatedPackages, failedPackages } = await buildImpl.exec();

            if (failedPackages.length > 0)
                throw new Error('Unable to build packages, Following packages failed to build' + failedPackages);

            for (let generatedPackage of generatedPackages) {
                await ArtifactGenerator.generateArtifact(generatedPackage, process.cwd(), 'artifacts');
                this.artifactFetchedCount++;
            }
            buildArtifactsLogGroup.end();
        }

        function isPkgToBeInstalled(pkg, restrictedPackages?: string[]): boolean {
            let ignoreOnStageFound = pkg.ignoreOnStage?.find((stage) => {
                stage = stage.toLowerCase();
                if (stage === 'prepare') return true;
            });

            //if ignored .. skip
            if (ignoreOnStageFound) return false;

            if (restrictedPackages) return restrictedPackages.includes(pkg.package);
            else return true;
        }

        function includeOnlyPackagesAsPerReleaseConfig(
            releaseConfigFilePath: string,
            buildProps: BuildProps,
            logger?: Logger
        ): BuildProps {
            if (releaseConfigFilePath) {
                let releaseConfig: ReleaseConfig = new ReleaseConfig(logger, releaseConfigFilePath);
                buildProps.includeOnlyPackages = releaseConfig.getPackagesAsPerReleaseConfig();
                printIncludeOnlyPackages(buildProps.includeOnlyPackages);
            }
            return buildProps;

            function printIncludeOnlyPackages(includeOnlyPackages: string[]) {
                SFPLogger.log(
                    COLOR_KEY_MESSAGE(`Build will include the below packages as per inclusive filter`),
                    LoggerLevel.INFO
                );
                SFPLogger.log(COLOR_KEY_VALUE(`${includeOnlyPackages.toString()}`), LoggerLevel.INFO);
            }
        }
    }
}
