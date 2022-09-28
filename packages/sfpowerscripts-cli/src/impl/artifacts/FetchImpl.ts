import * as fs from 'fs-extra';
import Git from '@dxatscale/sfpowerscripts.core/lib/git/Git';
import GitTags from '@dxatscale/sfpowerscripts.core/lib/git/GitTags';
import ReleaseDefinitionSchema from '../release/ReleaseDefinitionSchema';
import FetchArtifactsError from './FetchArtifactsError';
import * as rimraf from 'rimraf';
import FetchArtifactSelector from './FetchArtifactSelector';
import _ from 'lodash';
import path from 'path';
import FileUtils from '@dxatscale/sfpowerscripts.core/lib/utils/Fileutils';
import SFPLogger, { Logger, LoggerLevel } from '@dxatscale/sfp-logger';

export default class FetchImpl {
    constructor(
        private artifactDirectory: string,
        private scriptPath: string,
        private scope: string,
        private npmrcPath: string,
        private logger:Logger
    ) {
        if (!fs.existsSync(artifactDirectory)) fs.mkdirpSync(artifactDirectory);
    }

    public async fetchArtifacts(
        releaseDefinitions: ReleaseDefinitionSchema[]
    ): Promise<{
        success: ArtifactVersion[];
        failed: ArtifactVersion[];
    }> {
        const git: Git = await Git.initiateRepo();

        let fetchedArtifacts: { success: ArtifactVersion[]; failed: ArtifactVersion[] } = {
            success: [],
            failed: [],
        };

        let allArtifacts: { name: string; version: string }[] = [];

        
        for (const releaseDefinition of releaseDefinitions) {
            //Each release will be downloaded to specific subfolder inside the provided artifact directory
            //As each release is a collection of artifacts
            let revisedArtifactDirectory = path.join(
                this.artifactDirectory,
                releaseDefinition.release.replace(/[/\\?%*:|"<>]/g, '-')
            );

            rimraf.sync(revisedArtifactDirectory);
            fs.mkdirpSync(revisedArtifactDirectory);

            let artifactsToDownload: { name: string; version: string }[] = [];
            //additional sanity to not  repeat download
            for (let artifactEntry of Object.entries(releaseDefinition.artifacts)) {
                if (!_.includes(allArtifacts, { name: artifactEntry[0], version: artifactEntry[1] }, 0)) {
                    allArtifacts.push({ name: artifactEntry[0], version: artifactEntry[1] });
                    artifactsToDownload.push({ name: artifactEntry[0], version: artifactEntry[1] });
                }
            }

            for (let artifact of artifactsToDownload) {
                try {
                    await this.fetchAnArtifact(
                        artifact,
                        git,
                        this.scriptPath,
                        this.scope,
                        this.npmrcPath,
                        revisedArtifactDirectory
                    );

                    fetchedArtifacts.success.push(artifact);
                } catch (error) {
                    SFPLogger.log(error.message,LoggerLevel.DEBUG,this.logger);
                    fetchedArtifacts.failed.push(artifact);
                }
            }
        }

        return fetchedArtifacts;
    }

    public async fetchArtifactsProvidedVersion(
        artifactVersions: ArtifactVersion[]
    ): Promise<{
        success: ArtifactVersion[];
        failed: ArtifactVersion[];
    }> {
        const git: Git = await Git.initiateRepo();

        let fetchedArtifacts: { success: ArtifactVersion[]; failed: ArtifactVersion[] } = {
            success: [],
            failed: [],
        };

        let allArtifacts: ArtifactVersion[] = _.clone(artifactVersions);
        let revisedArtifactDirectory = path.join(this.artifactDirectory, FileUtils.makefolderid(8));
        rimraf.sync(revisedArtifactDirectory);
        fs.mkdirpSync(revisedArtifactDirectory);

        let i: number;

        for (const artifactVersion of artifactVersions) {
            try {
                await this.fetchAnArtifact(
                    artifactVersion,
                    git,
                    this.scriptPath,
                    this.scope,
                    this.npmrcPath,
                    revisedArtifactDirectory
                );

                fetchedArtifacts.success.push(artifactVersion);
            } catch (error) {
                SFPLogger.log(error.message,LoggerLevel.DEBUG,this.logger);
                fetchedArtifacts.failed.push(artifactVersion);
            }
        }

        return fetchedArtifacts;
    }

    private async fetchAnArtifact(
        artifact: ArtifactVersion,
        git: Git,
        scriptPath: string,
        scope: string,
        npmrcPath: string,
        revisedArtifactDirectory: string
    ) {
        let version: string;
        if (artifact.version === 'LATEST_TAG' || artifact.version === 'LATEST_GIT_TAG') {
            let latestGitTagVersion: GitTags = new GitTags(git, artifact.name);
            version = await latestGitTagVersion.getVersionFromLatestTag();
        } else version = artifact.version;

        let artifactFetcher = new FetchArtifactSelector(scriptPath, scope, npmrcPath).getArtifactFetcher();
        artifactFetcher.fetchArtifact(artifact.name, revisedArtifactDirectory, version, false);
    }
}
export type ArtifactVersion = {
    name: string;
    version: string;
};
