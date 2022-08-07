import SFPOrg from '@dxatscale/sfpowerscripts.core/lib/org/SFPOrg';
import simplegit, { GitError, SimpleGit } from 'simple-git';
const tmp = require('tmp');
import * as fs from 'fs-extra';
import GitIdentity from '../git/GitIdentity';
import ReleaseDefinitionSchema from './ReleaseDefinitionSchema';
import ProjectConfig from '@dxatscale/sfpowerscripts.core/lib/project/ProjectConfig';
import Ajv, { _ } from 'ajv';
import SFPLogger, { COLOR_HEADER, COLOR_KEY_MESSAGE } from '@dxatscale/sfp-logger';
import ReleaseDefinitionGeneratorConfigSchema from './ReleaseDefinitionGeneratorConfigSchema';
import Git from '@dxatscale/sfpowerscripts.core/lib/git/Git';
import lodash = require('lodash');
import { ReleaseChangelog } from '../changelog/ReleaseChangelogInterfaces';
import { LoggerLevel } from '@dxatscale/sfp-logger';
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
        private sfpOrg: SFPOrg,
        pathToReleaseDefinition: string,
        private releaseName:string,
        private branch: string,
        private push: boolean = false,
        private forcePush: boolean = false
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
        //Generate releaseName if not set in the cli
        if(!this.releaseName)
          this.releaseName = await this.generateReleaseName();

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
                            console.log('Failed to push changelog');
                            console.log(`Retrying...(${retryNum})`);
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
        let tempDir = tmp.dirSync({ unsafeCleanup: true });
        let repoDir: string;
        let git: SimpleGit;
        try {
            if (this.push) {
                repoDir = tempDir.name;
                // Copy source directory to temp dir
                fs.copySync(process.cwd(), repoDir);
                git = simplegit(repoDir);
                if (process.env.SFPOWERSCRIPTS_OVERRIDE_ORIGIN_URL) {
                    //Change in ORIGIN_URL, so do a clone
                    await git.clone(process.env.SFPOWERSCRIPTS_OVERRIDE_ORIGIN_URL, repoDir);
                } else {
                    // Copy source directory to temp dir
                    fs.copySync(process.cwd(), repoDir);
                    // Update local refs from remote
                    await git.fetch('origin');
                }
            } else {
                git = simplegit(repoDir);
                repoDir = process.cwd();
            }

            //Read Project Config from current branch
            let projectConfig = ProjectConfig.getSFDXProjectConfig(null);
            let installedArtifacts = await this.sfpOrg.getAllInstalledArtifacts();
            //figure out all package dependencies
            let packageDependencies = {};
            let artifacts = {};
            for (const installedArtifact of installedArtifacts) {
                if (installedArtifact.isInstalledBySfpowerscripts == false && installedArtifact.subscriberVersion) {
                    let packageAliases = Object.keys(projectConfig.packageAliases);
                    for (const packageAlias of packageAliases) {
                        if (installedArtifact.subscriberVersion == projectConfig.packageAliases[packageAlias]) {
                            if (this.getDependencyPredicate(installedArtifact.name))
                                packageDependencies[installedArtifact.name] = installedArtifact.subscriberVersion;
                        }
                    }
                } else if (installedArtifact.isInstalledBySfpowerscripts == true) {
                    let packagesInRepo = ProjectConfig.getAllPackages(null);
                    let packageFound = packagesInRepo.find((elem) => elem == installedArtifact.name);
                    if (packageFound) {
                        let pos = installedArtifact.version.lastIndexOf('.');
                        let version =
                            installedArtifact.version.substring(0, pos) +
                            '-' +
                            installedArtifact.version.substring(pos + 1);
                        if (this.getArtifactPredicate(installedArtifact.name)) {
                            artifacts[installedArtifact.name] = version;
                        }
                    }
                }
            }

            let releaseDefinition: ReleaseDefinitionSchema = {
                release: this.releaseName,
                skipIfAlreadyInstalled: true,
                artifacts: artifacts,
            };

            //Add package dependencies
            if (Object.keys(packageDependencies).length > 0)
                releaseDefinition.packageDependencies = packageDependencies;

            //Add changelog info
            releaseDefinition.changelog = this.releaseDefinitionGeneratorConfigSchema.changelog;

            let releaseDefinitonYAML = yaml.dump(releaseDefinition, {
                styles: {
                    '!!null': 'canonical', // dump null as ~
                },
                sortKeys: false, // sort object keys
            });

            SFPLogger.log(
                COLOR_HEADER(`------------Generated Release Definition for ${this.releaseName}----------------`)
            );
            SFPLogger.log(``);
            SFPLogger.log(COLOR_KEY_MESSAGE(releaseDefinitonYAML));

            if (this.push) {
                SFPLogger.log(`Checking out branch ${this.branch}`);
                await this.createBranch(git);
                fs.writeFileSync(path.join(repoDir, `${this.releaseName}.yml`), releaseDefinitonYAML);
                await this.pushReleaseDefinitionToBranch(this.branch, git, this.forcePush);
            } else if (this.branch && !this.push) {
                SFPLogger.log(`Checking out branch ${this.branch}`);
                await this.createBranch(git);
                fs.writeFileSync(path.join(repoDir, `${this.releaseName}.yml`), releaseDefinitonYAML);
                await this.commitFile(git);
            } else fs.writeFileSync(path.join(repoDir, `${this.releaseName}.yml`), releaseDefinitonYAML);

            return releaseDefinitonYAML.toString();
        } catch (error) {
            console.log(error);
        } finally {
            tempDir.removeCallback();
        }
    }
    private async createBranch(git: SimpleGit) {
        if (await this.isBranchExists(this.branch, git)) {
            await git.checkout(this.branch, ['-f']);
            try {
                // For ease-of-use when running locally and local branch exists
                await git.merge([`refs/remotes/origin/${this.branch}`]);
            } catch (error) {
                SFPLogger.log(`Unable to find remote`,LoggerLevel.TRACE);
            }
        } else {
            await git.checkout(['-b', this.branch]);
        }
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

    private async generateReleaseName(): Promise<string> {
        //grab release name from changelog.json
        let releaseName;
        if (this.releaseDefinitionGeneratorConfigSchema.changelogBranchRef) {
            let changelogBranchRef = this.releaseDefinitionGeneratorConfigSchema.changelogBranchRef;
            const git: Git = new Git(null);
            await git.fetch();

            if (!changelogBranchRef.includes('origin')) {
                // for user convenience, use full ref name to avoid errors involving missing local refs
                changelogBranchRef = `remotes/origin/${changelogBranchRef}`;
            }

            let changelogFileContents = await git.show([`${changelogBranchRef}:releasechangelog.json`]);
            let changelog: ReleaseChangelog = JSON.parse(changelogFileContents);
            //Get last release name and sanitize it
            let release = changelog.releases.pop();
            let name = release.names.pop();
            let buildNumber = release.buildNumber;
            releaseName = name.replace(/[/\\?%*:|"<>]/g, '-').concat(`-`, buildNumber.toString());
            return releaseName;
        } else {
            return this.releaseDefinitionGeneratorConfigSchema.releaseName;
        }
    }

    private async pushReleaseDefinitionToBranch(branch: string, git: SimpleGit, isForce: boolean) {
        SFPLogger.log(`Pushing release definiton file to ${branch}`);
        await this.commitFile(git);
        if (isForce) {
            await git.push('origin', branch, [`--force`]);
        } else {
            await git.push('origin', branch);
        }
    }

    private async commitFile(git: SimpleGit) {
        try
        {
        await new GitIdentity(git).setUsernameAndEmail();
        await git.add([`${this.releaseName}.yml`]);
        await git.commit(`[skip ci] Updated Release Defintiion ${this.releaseName}`);
        SFPLogger.log(`Committed Release defintion ${this.releaseName}.yml to branch ${this.branch} `);
        }
        catch(errror)
        {
            SFPLogger.log(`Unable to commit file, probably due to no change or something else,Please try manually`,LoggerLevel.ERROR);
        }
    }

    private async isBranchExists(branch: string, git: SimpleGit): Promise<boolean> {
        const listOfBranches = await git.branch(['-la']);

        return listOfBranches.all.find((elem) => elem.endsWith(branch)) ? true : false;
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
