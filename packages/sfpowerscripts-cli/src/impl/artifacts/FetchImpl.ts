import * as fs from 'fs-extra';
import Git from '@dxatscale/sfpowerscripts.core/lib/git/Git';
import GitTags from '@dxatscale/sfpowerscripts.core/lib/git/GitTags'
import ReleaseDefinitionSchema from '../release/ReleaseDefinitionSchema';
import FetchArtifactsError from './FetchArtifactsError';
import * as rimraf from 'rimraf';
import FetchArtifactSelector from './FetchArtifactSelector';
import _ from 'lodash';
import path from 'path';

export default class FetchImpl {
     constructor(
        private releaseDefinitions: ReleaseDefinitionSchema[],
        private artifactDirectory: string,
        private scriptPath: string,
        private isNpm: boolean,
        private scope: string,
        private npmrcPath: string
    ) {}

    async exec(): Promise<{
        success: ArtifactVersion[];
        failed: ArtifactVersion[];
    }> {
        let fetchedArtifacts: {
            success: ArtifactVersion[];
            failed: ArtifactVersion[];
        };

        fetchedArtifacts = await this.fetchArtifacts(
            this.releaseDefinitions,
            this.artifactDirectory,
            this.scriptPath,
            this.scope,
            this.npmrcPath
        );

        return fetchedArtifacts;
    }

    private async fetchArtifacts(
        releaseDefinitions: ReleaseDefinitionSchema[],
        artifactDirectory: string,
        scriptPath: string,
        scope: string,
        npmrcPath: string
    ): Promise<{
        success: ArtifactVersion[];
        failed: ArtifactVersion[];
    }> {
        const git: Git = await Git.initiateRepo();


        let fetchedArtifacts: { success: ArtifactVersion[]; failed: ArtifactVersion[] }={
            success: [],
            failed: []
        }

        let allArtifacts: { name: string; version: string }[] = [];
       

        let i: number;
        try {
            for (const releaseDefinition of releaseDefinitions) {

              
                //Each release will be downloaded to specific subfolder inside the provided artifact directory
                //As each release is a collection of artifacts
                let revisedArtifactDirectory = path.join(artifactDirectory,releaseDefinition.release.replace(/[/\\?%*:|"<>]/g, '-'));

                rimraf.sync(revisedArtifactDirectory);
                fs.mkdirpSync(revisedArtifactDirectory);

                let artifactsToDownload: { name: string; version: string }[] = [];
                //additional sanity to not  repeat download
                for (let artifactEntry of Object.entries(releaseDefinition.artifacts)) {
                    if (!_.includes(allArtifacts, { name: artifactEntry[0], version: artifactEntry[1] }, 0)){
                        allArtifacts.push({ name: artifactEntry[0], version: artifactEntry[1] });
                        artifactsToDownload.push({ name: artifactEntry[0], version: artifactEntry[1] });
                    }   
                }

                for (let artifact of artifactsToDownload) {
                    let version: string;
                    if (artifact.version === 'LATEST_TAG' || artifact.version === 'LATEST_GIT_TAG') {
                        let latestGitTagVersion: GitTags = new GitTags(git,artifact.name);
                        version = await latestGitTagVersion.getVersionFromLatestTag();
                    } else version = artifact.version;

                    let artifactFetcher = new FetchArtifactSelector(scriptPath, scope, npmrcPath).getArtifactFetcher();
                    artifactFetcher.fetchArtifact(artifact.name, revisedArtifactDirectory, version, false);

                    fetchedArtifacts.success.push(artifact);
                }
            }
        } catch (error) {
            console.log(error.message);
            fetchedArtifacts.failed = allArtifacts.slice(i);
            throw new FetchArtifactsError('Failed to fetch artifacts', fetchedArtifacts, error);
        }

        return fetchedArtifacts;
    }
}
export type ArtifactVersion = {
    name: string;
    version: string;
};
