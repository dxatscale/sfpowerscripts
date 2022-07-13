import SFPOrg from '@dxatscale/sfpowerscripts.core/lib/org/SFPOrg';
import simplegit, { GitError, SimpleGit } from 'simple-git';
const tmp = require('tmp');
import * as fs from 'fs-extra';
import GitIdentity from '../git/GitIdentity';
import ReleaseDefinitionSchema from './ReleaseDefinitionSchema';
import ProjectConfig from '@dxatscale/sfpowerscripts.core/lib/project/ProjectConfig';
import { _ } from 'ajv';
import SFPLogger, { COLOR_HEADER, COLOR_KEY_MESSAGE } from '@dxatscale/sfp-logger';
const retry = require('async-retry');
const yaml = require('js-yaml');
const path = require('path');

export default class ReleaseDefinitionGenerator {
    public constructor(
        private sfpOrg: SFPOrg,
        private releaseName: string,
        private branch: string,
        private push: boolean = false,
        private forcePush: boolean = false
    ) {}

    exec() {
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
            // Update local refs from remote
            await git.fetch('origin');

           

            let installedArtifacts = await this.sfpOrg.getAllInstalledArtifacts();
            //figure out all package dependencies
            let packageDependencies = {};
            let artifacts = {};
            for (const installedArtifact of installedArtifacts) {
                if (installedArtifact.isInstalledBySfpowerscripts == false && installedArtifact.subscriberVersion) {
                    //TODO:filter aliases by sfdx project json
                    packageDependencies[installedArtifact.name] = installedArtifact.subscriberVersion;
                } else if (installedArtifact.isInstalledBySfpowerscripts == true) {
                    let packagesInRepo = ProjectConfig.getAllPackages(null);
                    let packageFound = packagesInRepo.find((elem) => elem == installedArtifact.name);
                    if (packageFound) {
                        artifacts[installedArtifact.name] = installedArtifact.version;
                    }
                }
            }

            let releaseDefinition: ReleaseDefinitionSchema = {
                release: this.releaseName,
                skipIfAlreadyInstalled: true,
                packageDependencies: packageDependencies,
                artifacts: artifacts,
            };

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
                fs.writeFileSync(path.join(repoTempDir, `${this.releaseName}.yaml`), releaseDefinitonYAML);
                await this.pushReleaseDefinitionToBranch(this.branch, git, this.forcePush);
            }
            else 
            fs.writeFileSync(path.join(repoTempDir, `${this.releaseName}.yaml`), releaseDefinitonYAML);
            return releaseDefinitonYAML.toString();
        } catch (error) {
            console.log(error);
        } finally {
            tempDir.removeCallback();
        }
    }

    private async pushReleaseDefinitionToBranch(branch: string, git: SimpleGit, isForce: boolean) {
        console.log('Pushing release definiton file to', branch);

        await new GitIdentity(git).setUsernameAndEmail();
        await git.add([`${this.releaseName}.yaml`]);
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
