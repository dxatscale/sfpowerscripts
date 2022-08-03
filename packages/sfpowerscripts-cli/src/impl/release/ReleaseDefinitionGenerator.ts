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
const retry = require('async-retry');
const yaml = require('js-yaml');
const path = require('path');

export default class ReleaseDefinitionGenerator {
    private _releaseDefinitionGeneratorSchema: ReleaseDefinitionGeneratorConfigSchema;
    private releaseName;

    get releaseDefinitionGenratorConfigSchema() {
        // Return clone of releaseDefinition for immutability
        return lodash.cloneDeep(this._releaseDefinitionGeneratorSchema);
    }

    public constructor(
        private sfpOrg: SFPOrg,
        pathToReleaseDefinition: string,
        private branch: string,
        private push: boolean = false,
        private forcePush: boolean = false
    ) {
        this._releaseDefinitionGeneratorSchema = yaml.load(fs.readFileSync(pathToReleaseDefinition, 'utf8'));
        this.validateReleaseDefinitionGeneratorConfig(this._releaseDefinitionGeneratorSchema);

        // Workaround for jsonschema not supporting validation based on dependency value
        if (
            this._releaseDefinitionGeneratorSchema.baselineOrg &&
            !this._releaseDefinitionGeneratorSchema.skipIfAlreadyInstalled
        )
            throw new Error("Release option 'skipIfAlreadyInstalled' must be true for 'baselineOrg'");
    }

    async exec() {
        //Generate releaseName
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

        try {
            const repoTempDir = tempDir.name;

            // Copy source directory to temp dir
            fs.copySync(process.cwd(), repoTempDir);

            let git: SimpleGit = simplegit(repoTempDir);
            if (process.env.SFPOWERSCRIPTS_OVERRIDE_ORIGIN_URL) {
                //Change in ORIGIN_URL, so do a clone
                await git.clone(process.env.SFPOWERSCRIPTS_OVERRIDE_ORIGIN_URL, repoTempDir);
            } else {
                // Copy source directory to temp dir
                fs.copySync(process.cwd(), repoTempDir);
                // Update local refs from remote
                await git.fetch('origin');
            }
            let installedArtifacts = await this.sfpOrg.getAllInstalledArtifacts();
            //figure out all package dependencies
            let packageDependencies = {};
            let artifacts = {};
            for (const installedArtifact of installedArtifacts) {
                if (installedArtifact.isInstalledBySfpowerscripts == false && installedArtifact.subscriberVersion) {
                    let projectConfig = ProjectConfig.getSFDXProjectConfig(null);
                    let packageAliases = Object.keys(projectConfig.packageAliases);
                    for (const packageAlias of packageAliases) {
                        if (installedArtifact.subscriberVersion == projectConfig.packageAliases[packageAlias]) {
                            if (
                                !this.releaseDefinitionGenratorConfigSchema.excludePackageDependencies?.includes(
                                    installedArtifact.name
                                )
                            )
                                packageDependencies[installedArtifact.name] = installedArtifact.subscriberVersion;
                        }
                    }
                } else if (installedArtifact.isInstalledBySfpowerscripts == true) {
                    let packagesInRepo = ProjectConfig.getAllPackages(null);
                    let packageFound = packagesInRepo.find((elem) => elem == installedArtifact.name);
                    if (packageFound) {
                        if (
                            !this.releaseDefinitionGenratorConfigSchema.excludeArtifacts?.includes(
                                installedArtifact.name
                            )
                        ) {
                            let pos = installedArtifact.version.lastIndexOf('.');
                            let version =
                                installedArtifact.version.substring(0, pos) +
                                '-' +
                                installedArtifact.version.substring(pos + 1);
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
            releaseDefinition.changelog = this.releaseDefinitionGenratorConfigSchema.changelog;

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
                console.log(`Checking out branch ${this.branch}`);
                if (await this.isBranchExists(this.branch, git)) {
                    await git.checkout(this.branch);

                    // For ease-of-use when running locally and local branch exists
                    await git.merge([`refs/remotes/origin/${this.branch}`]);
                } else {
                    await git.checkout(['-b', this.branch]);
                }
                fs.writeFileSync(path.join(repoTempDir, `${this.releaseName}.yml`), releaseDefinitonYAML);
                await this.pushReleaseDefinitionToBranch(this.branch, git, this.forcePush);
            } else fs.writeFileSync(path.join(repoTempDir, `${this.releaseName}.yml`), releaseDefinitonYAML);
            return releaseDefinitonYAML.toString();
        } catch (error) {
            console.log(error);
        } finally {
            tempDir.removeCallback();
        }
    }
    private validateReleaseDefinitionGeneratorConfig(
        releaseDefinitionGeneratorSchema: ReleaseDefinitionGeneratorConfigSchema
    ): void {
        let schema = fs.readJSONSync(
            path.join(__dirname, '..', '..', '..', 'resources', 'schemas', 'releasedefintiongenerator.schema.json'),
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
        if (this.releaseDefinitionGenratorConfigSchema.changelogBranchRef) {
            let changelogBranchRef = this.releaseDefinitionGenratorConfigSchema.changelogBranchRef;
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
            return this.releaseDefinitionGenratorConfigSchema.releaseName;
        }
    }

    private async pushReleaseDefinitionToBranch(branch: string, git: SimpleGit, isForce: boolean) {
        console.log('Pushing release definiton file to', branch);

        await new GitIdentity(git).setUsernameAndEmail();
        await git.add([`${this.releaseName}.yml`]);
        await git.commit(`[skip ci] Updated Release Defintiion ${this.releaseName}`);

        if (isForce) {
            await git.push('origin', branch, [`--force`]);
        } else {
            await git.push('origin', branch);
        }
    }

    private async isBranchExists(branch: string, git: SimpleGit): Promise<boolean> {
        const listOfBranches = await git.branch(['-la']);

        return listOfBranches.all.find((elem) => elem.endsWith(branch)) ? true : false;
    }
}
