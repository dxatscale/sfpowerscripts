import { GitError } from 'simple-git';
import * as fs from 'fs-extra';
import ReleaseDefinition from './ReleaseDefinition';
import ProjectConfig from '../../core/project/ProjectConfig';
import Ajv, { _ } from 'ajv';
import SFPLogger, { COLOR_HEADER, COLOR_KEY_MESSAGE, Logger } from '@flxblio/sfp-logger';
import ReleaseConfig from './ReleaseConfig';
import lodash = require('lodash');
import { LoggerLevel } from '@flxblio/sfp-logger';
import Git from '../../core/git/Git';
import GitTags from '../../core/git/GitTags';
const retry = require('async-retry');
const yaml = require('js-yaml');
const path = require('path');

export default class ReleaseDefinitionGenerator {
    private _releaseConfiguration: ReleaseConfig;

    get releaseConfiguration() {
        // Return clone of releaseDefinition for immutability
        return lodash.cloneDeep(this._releaseConfiguration);
    }

    public constructor(
        private logger: Logger,
        private gitRef: string,
        pathToReleaseDefinition: string,
        private releaseName: string,
        private branch: string,
        private metadata: any,
        private directory?: string,
        private noPush: boolean = false,
        private forcePush: boolean = false,
        private inMemoryMode:boolean = false
    ) {
        this._releaseConfiguration = yaml.load(fs.readFileSync(pathToReleaseDefinition, 'utf8'));
        this.validateReleaseDefinitionGeneratorConfig(this._releaseConfiguration);


        //Attempt to parse metadata flag into JSON
        if (this.metadata) {
            try {
                this.metadata = JSON.parse(this.metadata);
            } catch (error) {
                throw new Error(`Invalid JSON for metadata flag: ${error}`);
            }
        }   

        // Easy to handle here than with schema
        if (
            this._releaseConfiguration.includeOnlyArtifacts &&
            this.releaseConfiguration.excludeArtifacts
        ) {
            throw new Error('Error: Invalid schema: either use includeArtifacts or excludeArtifacts');
        }
        // Easy to handle here than with schema
        if (
            this._releaseConfiguration.includeOnlyPackageDependencies &&
            this.releaseConfiguration.excludePackageDependencies
        ) {
            throw new Error(
                'Error: Invalid schema: either use includePackageDependencies or excludePackageDependencies'
            );
        }

        // Workaround for jsonschema not supporting validation based on dependency value
        if (
            this._releaseConfiguration.releasedefinitionProperties?.baselineOrg &&
            !this._releaseConfiguration.releasedefinitionProperties?.skipIfAlreadyInstalled
        )
            throw new Error("Release option 'skipIfAlreadyInstalled' must be true for 'baselineOrg'");
    }

    async exec(): Promise<ReleaseDefinition | {
        releaseDefinitonYAML: string;
        pathToReleaseDefnDirectory: string;
    }> {
        return retry(
            async (bail, retryNum) => {
                try {
                    return await this.execHandler();
                } catch (err) {
                    if (err instanceof GitError) {
                        if (!err.message.includes('failed to push some refs')) {
                            // Do not retry for Git errors that are not related to push
                            bail(err);
                        } else {
                            SFPLogger.log('Failed to push definition', LoggerLevel.WARN, this.logger);
                            SFPLogger.log(`Retrying...(${retryNum})`, LoggerLevel.WARN, this.logger);
                            throw err;
                        }
                    } else {
                        // Do not retry for non-Git errors
                        bail(err);
                    }
                }
            },
            {
                retries: 10,
                minTimeout: 5,
                randomize: true,
            }
        );
    }

    private async execHandler(): Promise<ReleaseDefinition | {
        releaseDefinitonYAML: string;
        pathToReleaseDefnDirectory: string;
    }> {
        let repoDir: string;
        let git;
        try {
            SFPLogger.log(`Processing Artifacts from reference.. ${this.gitRef}`, LoggerLevel.INFO, this.logger);
            git = await Git.initiateRepoAtTempLocation(this.logger);
            repoDir = git.getRepositoryPath();
            let fetchedArtifacts = await this.fetchFromGitRef(git);

            let releaseDefiniton = await this.generateReleaseDefintion(
                fetchedArtifacts.artifacts,
                fetchedArtifacts.packageDependencies,
                git
            );
            return releaseDefiniton;
        } catch (error) {
            SFPLogger.log(error, LoggerLevel.ERROR, this.logger);
        } finally {
            git.deleteTempoRepoIfAny();
        }
    }

    private async fetchFromGitRef(git: Git) {
        let artifacts = {};
        let packageDependencies = {};
        //Create A copy of repository to a particular commit
        //If already a duplicate directory switch to the passed git ref
        //then switch it back
        let headCommit = await git.getCurrentCommitId();
        await git.checkout(this.gitRef, true);

        let projectConfig = ProjectConfig.getSFDXProjectConfig(git.getRepositoryPath());
        //Read sfdx project json
        let sfdxPackages = ProjectConfig.getAllPackagesFromProjectConfig(projectConfig);
        for (const sfdxPackage of sfdxPackages) {
            let latestGitTagVersion = new GitTags(git, sfdxPackage);
            try {
                let version = await latestGitTagVersion.getVersionFromLatestTag();

                if (this.getArtifactPredicate(sfdxPackage)) {
                    artifacts[sfdxPackage] = version;
                }
            } catch (error) {
                SFPLogger.log(
                    `Unable to capture version of ${sfdxPackage} due to ${error}`,
                    LoggerLevel.WARN,
                    this.logger
                );
            }
        }

        if (!this.releaseConfiguration.excludeAllPackageDependencies) {
            let allExternalPackages = ProjectConfig.getAllExternalPackages(projectConfig);
            for (const externalPackage of allExternalPackages) {
                if (
                    this.getDependencyPredicate(externalPackage.alias) &&
                    externalPackage.Package2IdOrSubscriberPackageVersionId.startsWith('04t')
                ) {
                    packageDependencies[externalPackage.alias] = externalPackage.Package2IdOrSubscriberPackageVersionId;
                }
            }
        }

        return { artifacts, packageDependencies };
    }

    private async generateReleaseDefintion(artifacts: any, packageDependencies: any, git: Git): Promise<ReleaseDefinition | {
    releaseDefinitonYAML: string;
    pathToReleaseDefnDirectory: string;
}> {
        artifacts = Object.keys(artifacts)
            .sort()
            .reduce((obj, key) => {
                obj[key] = artifacts[key];
                return obj;
            }, {});

        packageDependencies = Object.keys(packageDependencies)
            .sort()
            .reduce((obj, key) => {
                obj[key] = packageDependencies[key];
                return obj;
            }, {});

        let releaseDefinition: ReleaseDefinition = {
            release: this.releaseName,
            releaseConfigName : this.releaseConfiguration?.releaseName,
            metadata: this.metadata,
            skipIfAlreadyInstalled: true,
            skipArtifactUpdate:false,
            artifacts: artifacts,
        };

        //Add package dependencies
        if (Object.keys(packageDependencies).length > 0) releaseDefinition.packageDependencies = packageDependencies;

        //add promotePackagesBeforeDeploymentToOrg
        releaseDefinition.promotePackagesBeforeDeploymentToOrg = this.releaseConfiguration.releasedefinitionProperties?.promotePackagesBeforeDeploymentToOrg;
	    
        //override skip if already installed
        if(this.releaseConfiguration.releasedefinitionProperties?.skipIfAlreadyInstalled)
          releaseDefinition.skipIfAlreadyInstalled = this.releaseConfiguration.releasedefinitionProperties?.skipIfAlreadyInstalled;

        //override skip artifact update
        if(this.releaseConfiguration.releasedefinitionProperties?.skipArtifactUpdate)
            releaseDefinition.skipArtifactUpdate = this.releaseConfiguration.releasedefinitionProperties?.skipArtifactUpdate;

        //Add changelog info
        releaseDefinition.changelog = this.releaseConfiguration.releasedefinitionProperties?.changelog;

        if(this.inMemoryMode)
         return releaseDefinition;

        let releaseDefinitonYAML = yaml.dump(releaseDefinition, {
            styles: {
                '!!null': 'canonical', // dump null as ~
            },
            sortKeys: false, // sort object keys
        });

        SFPLogger.log(COLOR_HEADER(`------------Generated Release Definition for ${this.releaseName}----------------`));
        SFPLogger.log(``);
        SFPLogger.log(COLOR_KEY_MESSAGE(releaseDefinitonYAML));

        let pathToReleaseDefnDirectory = this.createDirectory(this.directory, git.getRepositoryPath());
        fs.writeFileSync(path.join(pathToReleaseDefnDirectory, `${this.releaseName}.yml`), releaseDefinitonYAML);
        if (this.branch) {
            SFPLogger.log(`Checking out branch ${this.branch}`);
            await git.createBranch(this.branch);
            await git.commitFile([path.join(pathToReleaseDefnDirectory, `${this.releaseName}.yml`)]);
            if (!this.noPush) await git.pushToRemote(this.branch, this.forcePush);
        }

        return { releaseDefinitonYAML, pathToReleaseDefnDirectory };
    }

    private createDirectory(directory: string, repoDir: string): string {
        if (this.directory) {
            if (!fs.pathExistsSync(path.join(repoDir, directory))) {
                fs.mkdirpSync(path.join(repoDir, directory));
            }
            repoDir = path.join(repoDir, this.directory);
        }
        return repoDir;
    }

    private validateReleaseDefinitionGeneratorConfig(
        releaseDefinitionGeneratorSchema: ReleaseConfig
    ): void {
        let schema = fs.readJSONSync(
            path.join(__dirname, '..', '..', '..', 'resources', 'schemas', 'release-config.schema.json'),
            { encoding: 'UTF-8' }
        );

        let validator = new Ajv({ allErrors: true }).compile(schema);
        let validationResult = validator(releaseDefinitionGeneratorSchema);

        if (!validationResult) {
            let errorMsg: string =
                `Release definition generation config does not meet schema requirements, ` +
                `found ${validator.errors.length} validation errors:\n`;

            validator.errors.forEach((error, errorNum) => {
                errorMsg += `\n${errorNum + 1}: ${error.instancePath}: ${error.message} ${JSON.stringify(
                    error.params,
                    null,
                    4
                )}`;
            });

            throw new Error(errorMsg);
        }
    }

    private getArtifactPredicate(artifact: string): boolean {
        if (this.releaseConfiguration.includeOnlyArtifacts) {
            return this.releaseConfiguration.includeOnlyArtifacts?.includes(artifact);
        } else if (this.releaseConfiguration.excludeArtifacts) {
            return !this.releaseConfiguration.excludeArtifacts?.includes(artifact);
        } else return true;
    }

    private getDependencyPredicate(artifact: string): boolean {
        if (this.releaseConfiguration.includeOnlyPackageDependencies) {
            return this.releaseConfiguration.includeOnlyPackageDependencies?.includes(artifact);
        } else if (this.releaseConfiguration.excludePackageDependencies) {
            return !this.releaseConfiguration.excludePackageDependencies?.includes(artifact);
        } else return true;
    }
}