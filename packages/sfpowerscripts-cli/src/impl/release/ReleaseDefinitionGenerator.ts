import  { GitError } from 'simple-git';
import * as fs from 'fs-extra';
import ReleaseDefinitionSchema from './ReleaseDefinitionSchema';
import ProjectConfig from '@dxatscale/sfpowerscripts.core/lib/project/ProjectConfig';
import Ajv, { _ } from 'ajv';
import SFPLogger, { COLOR_HEADER, COLOR_KEY_MESSAGE, Logger } from '@dxatscale/sfp-logger';
import ReleaseDefinitionGeneratorConfigSchema from './ReleaseDefinitionGeneratorConfigSchema';
import lodash = require('lodash');
import { LoggerLevel } from '@dxatscale/sfp-logger';
import Git from '@dxatscale/sfpowerscripts.core/lib/git/Git';
import GitTags from '@dxatscale/sfpowerscripts.core/lib/git/GitTags';
const retry = require('async-retry');
const yaml = require('js-yaml');
const path = require('path');

export default class ReleaseDefinitionGenerator {
    private _releaseDefinitionGeneratorSchema: ReleaseDefinitionGeneratorConfigSchema;


    get releaseDefinitionGeneratorConfigSchema() {
        // Return clone of releaseDefinition for immutability
        return lodash.cloneDeep(this._releaseDefinitionGeneratorSchema);
    }

    public constructor(
        private logger:Logger,
        private gitRef: string,
        pathToReleaseDefinition: string,
        private releaseName: string,
        private branch: string,
        private directory?: string,
        private push: boolean = false,
        private forcePush: boolean = false,
    ) {
        this._releaseDefinitionGeneratorSchema = yaml.load(fs.readFileSync(pathToReleaseDefinition, 'utf8'));
        this.validateReleaseDefinitionGeneratorConfig(this._releaseDefinitionGeneratorSchema);
     
        // Easy to handle here than with schema
        if (
            this._releaseDefinitionGeneratorSchema.includeOnlyArtifacts &&
            this.releaseDefinitionGeneratorConfigSchema.excludeArtifacts
        ) {
            throw new Error('Error: Invalid schema: either use includeArtifacts or excludeArtifacts');
        }
        // Easy to handle here than with schema
        if (
            this._releaseDefinitionGeneratorSchema.includeOnlyPackageDependencies &&
            this.releaseDefinitionGeneratorConfigSchema.excludePackageDependencies
        ) {
            throw new Error(
                'Error: Invalid schema: either use includePackageDependencies or excludePackageDependencies'
            );
        }

        // Workaround for jsonschema not supporting validation based on dependency value
        if (
            this._releaseDefinitionGeneratorSchema.baselineOrg &&
            !this._releaseDefinitionGeneratorSchema.skipIfAlreadyInstalled
        )
            throw new Error("Release option 'skipIfAlreadyInstalled' must be true for 'baselineOrg'");
    }

    async exec() {
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
                            SFPLogger.log('Failed to push changelog',LoggerLevel.WARN,this.logger);
                            SFPLogger.log(`Retrying...(${retryNum})`,LoggerLevel.WARN,this.logger);
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

    private async execHandler() {
        let repoDir: string;
        let git;
        try {
            SFPLogger.log(`Processing Artifacts from reference.. ${this.gitRef}`,LoggerLevel.INFO,this.logger)
            if (this.push) {
                git = await Git.initiateRepoAtTempLocation(this.logger);
                repoDir = git.getRepositoryPath();
            } else {
                git = await Git.initiateRepo();
                repoDir = process.cwd();
            }

            let fetchedArtifacts = await this.fetchFromGitRef(git);

            let releaseDefinitonYAML = await this.generateReleaseDefintion(
                fetchedArtifacts.artifacts,
                fetchedArtifacts.packageDependencies,
                git
            );
            return releaseDefinitonYAML.toString();
        } catch (error) {
            SFPLogger.log(error, LoggerLevel.ERROR, this.logger);
        } finally {
            git.deleteTempoRepoIfAny();
        }
    }

    private async fetchFromGitRef(git: Git) {
        let artifacts = {};
        let packageDependencies = {};
        let isNewDuplicateCreated: boolean = false;
        let headCommit: string;
        //Create A copy of repository to a particular commit
        //If already a duplicate directory switch to the passed git ref
        //then switch it back
        let gitRepository = git;
        if (!git.isATemporaryRepo()) {
            gitRepository = await Git.initiateRepoAtTempLocation(this.logger,this.gitRef);
            isNewDuplicateCreated = true;
        } else {
            headCommit = await git.getCurrentCommitId();
            git.checkout(this.gitRef);
        }

    
        let projectConfig = ProjectConfig.getSFDXProjectConfig(gitRepository.getRepositoryPath());
        //Read sfdx project json
        let sfdxPackages = ProjectConfig.getAllPackagesFromProjectConfig(projectConfig);
        for (const sfdxPackage of sfdxPackages) {
            let latestGitTagVersion = new GitTags(gitRepository,sfdxPackage);
            let version = await latestGitTagVersion.getVersionFromLatestTag();
            if (this.getArtifactPredicate(sfdxPackage)) {
                artifacts[sfdxPackage] = version;
            }
        }

        let allExternalPackages = ProjectConfig.getAllExternalPackages(projectConfig);
        for (const externalPackage of allExternalPackages) {
            if (
                this.getDependencyPredicate(externalPackage.alias) &&
                externalPackage.Package2IdOrSubscriberPackageVersionId.startsWith('04t')
            ) {
                packageDependencies[externalPackage.alias] = externalPackage.Package2IdOrSubscriberPackageVersionId;
            }
        }
        if (isNewDuplicateCreated) gitRepository.deleteTempoRepoIfAny();
        else git.checkout(headCommit);
        return { artifacts, packageDependencies };
    }

    private async generateReleaseDefintion(artifacts: any, packageDependencies: any, git: Git) {
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

        let releaseDefinition: ReleaseDefinitionSchema = {
            release: this.releaseName,
            skipIfAlreadyInstalled: true,
            artifacts: artifacts,
        };

        //Add package dependencies
        if (Object.keys(packageDependencies).length > 0) releaseDefinition.packageDependencies = packageDependencies;

        //Add changelog info
        releaseDefinition.changelog = this.releaseDefinitionGeneratorConfigSchema.changelog;

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
            if (this.push) await git.pushToRemote(this.branch, this.forcePush);
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
        releaseDefinitionGeneratorSchema: ReleaseDefinitionGeneratorConfigSchema
    ): void {
        let schema = fs.readJSONSync(
            path.join(__dirname, '..', '..', '..', 'resources', 'schemas', 'releasedefinitiongenerator.schema.json'),
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
        if (this.releaseDefinitionGeneratorConfigSchema.includeOnlyArtifacts) {
            return this.releaseDefinitionGeneratorConfigSchema.includeOnlyArtifacts?.includes(artifact);
        } else if (this.releaseDefinitionGeneratorConfigSchema.excludeArtifacts) {
            return !this.releaseDefinitionGeneratorConfigSchema.excludeArtifacts?.includes(artifact);
        } else return true;
    }

    private getDependencyPredicate(artifact: string): boolean {
        if (this.releaseDefinitionGeneratorConfigSchema.includeOnlyPackageDependencies) {
            return this.releaseDefinitionGeneratorConfigSchema.includeOnlyPackageDependencies?.includes(artifact);
        } else if (this.releaseDefinitionGeneratorConfigSchema.excludePackageDependencies) {
            return !this.releaseDefinitionGeneratorConfigSchema.excludePackageDependencies?.includes(artifact);
        } else return true;
    }
}
