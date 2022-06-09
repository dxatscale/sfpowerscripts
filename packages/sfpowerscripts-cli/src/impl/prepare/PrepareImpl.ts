import { Org } from '@salesforce/core';
import { PoolConfig } from '@dxatscale/sfpowerscripts.core/lib/scratchorg/pool/PoolConfig';
import isValidSfdxAuthUrl from '@dxatscale/sfpowerscripts.core/lib/scratchorg/pool/prequisitecheck/IsValidSfdxAuthUrl';
import SFPLogger, {
    COLOR_KEY_MESSAGE,
    COLOR_WARNING,
    LoggerLevel,
} from '@dxatscale/sfpowerscripts.core/lib/logger/SFPLogger';
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
import { LatestGitTagVersion } from '../artifacts/LatestGitTagVersion';
import Git from '@dxatscale/sfpowerscripts.core/lib/git/Git';
import OrgDetailsFetcher from '@dxatscale/sfpowerscripts.core/lib/org/OrgDetailsFetcher';
import SFPOrg from '@dxatscale/sfpowerscripts.core/lib/org/SFPOrg';
import { EOL } from 'os';
import SFPStatsSender from '@dxatscale/sfpowerscripts.core/lib/stats/SFPStatsSender';
const Table = require('cli-table');

export default class PrepareImpl {
    private artifactFetchedCount: number = 0;

    public constructor(private hubOrg: Org, private pool: PoolConfig, private logLevel: LoggerLevel) {
        // set defaults
        if (!this.pool.expiry) this.pool.expiry = 2;

        if (!this.pool.batchSize) this.pool.batchSize = 5;

        if (this.pool.succeedOnDeploymentErrors === undefined) this.pool.succeedOnDeploymentErrors = true;

        if (!this.pool.waitTime) this.pool.waitTime = 6;
    }

    public async exec() {
        SFPLogger.log(COLOR_KEY_MESSAGE('Validating Org Authentication Mechanism..'), LoggerLevel.INFO);
        let orgDisplayResult = await new OrgDetailsFetcher(this.hubOrg.getUsername()).getOrgDetails();

        if (!(orgDisplayResult.sfdxAuthUrl && isValidSfdxAuthUrl(orgDisplayResult.sfdxAuthUrl)))
            throw new Error(
                `Pools have to be created using a DevHub authenticated with auth:web or auth:store or auth:accesstoken:store`
            );

        return this.poolScratchOrgs();
    }

    private async poolScratchOrgs(): Promise<Result<PoolConfig, PoolError>> {
        //Create Artifact Directory
        rimraf.sync('artifacts');
        fs.mkdirpSync('artifacts');

        if (this.pool.installAll) {
            // Fetch Latest Artifacts to Artifact Directory
            await this.getPackageArtifacts();
        }

        let prepareASingleOrgImpl: PrepareOrgJob = new PrepareOrgJob(this.pool);

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
    }

    private async displayPoolSummary(pool: PoolConfig) {
        let table = new Table({
            head: [
                'Scratch Org Alias Id',
                'Scratch Org Username',
                'Installed/Requested Count',
                'Last Installed Package',
            ],
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
                    SFPStatsSender.logGauge(`sfpowerscripts.pool.packages.requested`,this.artifactFetchedCount,{pool:this.pool.tag,scratchOrg:scratchOrg.alias});
                    SFPStatsSender.logGauge(`sfpowerscripts.pool.packages.installed`,installationCount,{pool:this.pool.tag,scratchOrg:scratchOrg.alias});
                } else {
                    table.push([scratchOrg.alias, scratchOrg.username, `NA`, `NA`]);
                    SFPStatsSender.logGauge(`sfpowerscripts.pool.packages.requested`,0,{pool:this.pool.tag,scratchOrg:scratchOrg.alias});
                    SFPStatsSender.logGauge(`sfpowerscripts.pool.packages.installed`,0,{pool:this.pool.tag,scratchOrg:scratchOrg.alias});
                }
              } catch (error) {
                SFPStatsSender.logGauge(`sfpowerscripts.pool.packages.requested`,0,{pool:this.pool.tag,scratchOrg:scratchOrg.alias});
                SFPStatsSender.logGauge(`sfpowerscripts.pool.packages.installed`,0,{pool:this.pool.tag,scratchOrg:scratchOrg.alias});
                table.push([scratchOrg.alias, scratchOrg.username, `Unable to compute`, `Unable to fetch`]);
              }
        }

        if (table.length >= 1) {
            SFPLogger.log(EOL, LoggerLevel.INFO);
            SFPLogger.log(COLOR_KEY_MESSAGE('Pool Summary:'), LoggerLevel.INFO);
            SFPLogger.log(table.toString(), LoggerLevel.INFO);
        }
    }

    private async getPackageArtifacts() {
        //Filter Packages to be ignore from prepare to be fetched
        let packages = ProjectConfig.getSFDXProjectConfig(null)['packageDirectories'].filter((pkg) => {
            if (
                pkg.ignoreOnStage?.find((stage) => {
                    stage = stage.toLowerCase();
                    return stage === 'prepare';
                })
            )
                return false;
            else return true;
        });

        let artifactFetcher: FetchAnArtifact;
        if (this.pool.fetchArtifacts) {
            artifactFetcher = new FetchArtifactSelector(
                this.pool.fetchArtifacts.artifactFetchScript,
                this.pool.fetchArtifacts.npm?.scope,
                this.pool.fetchArtifacts.npm?.npmrcPath
            ).getArtifactFetcher();

            const git: Git = new Git(null);
            let latestGitTagVersion: LatestGitTagVersion = new LatestGitTagVersion(git);

            //During Prepare, there could be a race condition where a main is merged with a new package
            //but the package is not yet available in the validated package list and can cause prepare to fail
            for (const pkg of packages) {
                try {
                    let version = await latestGitTagVersion.getVersionFromLatestTag(pkg.package);
                    artifactFetcher.fetchArtifact(pkg.package, 'artifacts', version, true);
                    this.artifactFetchedCount++;
                } catch (error) {
                    SFPLogger.log(
                        COLOR_WARNING(`Git Tag for ${pkg.package} missing, This might result in deployment failures`)
                    );
                }
            }
        } else {
            //Build All Artifacts
            console.log('\n');
            console.log(
                '-------------------------------------WARNING!!!!------------------------------------------------'
            );
            console.log('Building packages, as script to fetch artifacts was not provided');
            console.log('This is not ideal, as the artifacts are  built from the current head of the provided branch');
            console.log('Pools should be prepared with previously validated packages');
            console.log(
                '------------------------------------------------------------------------------------------------'
            );

            let buildProps: BuildProps = {
                configFilePath: this.pool.configFilePath,
                devhubAlias: this.hubOrg.getUsername(),
                waitTime: 120,
                isQuickBuild: true,
                isDiffCheckEnabled: false,
                buildNumber: 1,
                executorcount: 10,
                isBuildAllAsSourcePackages: true,
                branch: null,
                currentStage: Stage.PREPARE,
            };

            let buildImpl = new BuildImpl(buildProps);
            let { generatedPackages, failedPackages } = await buildImpl.exec();

            if (failedPackages.length > 0)
                throw new Error('Unable to build packages, Following packages failed to build' + failedPackages);

            for (let generatedPackage of generatedPackages) {
                await ArtifactGenerator.generateArtifact(generatedPackage, process.cwd(), 'artifacts');
                this.artifactFetchedCount++;
            }
        }
    }
}
