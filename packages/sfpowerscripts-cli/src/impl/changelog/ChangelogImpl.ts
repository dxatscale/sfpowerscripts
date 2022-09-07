import ArtifactFetcher, { Artifact } from '@dxatscale/sfpowerscripts.core/lib/artifacts/ArtifactFetcher';
import { ReleaseChangelog } from './ReleaseChangelog';
import ChangelogMarkdownGenerator from './ChangelogMarkdownGenerator';
import ReleaseChangelogUpdater from './ReleaseChangelogUpdater';
import * as fs from 'fs-extra';
import path = require('path');
import { marked } from 'marked';
const TerminalRenderer = require('marked-terminal');
const retry = require('async-retry');
import { GitError } from 'simple-git';
import SfpPackage from '@dxatscale/sfpowerscripts.core/lib/package/SfpPackage';
import SFPLogger, { LoggerLevel, ConsoleLogger, Logger } from '@dxatscale/sfp-logger';
import SfpPackageBuilder from '@dxatscale/sfpowerscripts.core/lib/package/SfpPackageBuilder';
import Git from '@dxatscale/sfpowerscripts.core/lib/git/Git';



marked.setOptions({
    // Define custom renderer
    renderer: new TerminalRenderer(),
});

export default class ChangelogImpl {
    constructor(
        private logger:Logger,
        private artifactDir: string,
        private releaseName: string,
        private workItemFilters: string[],
        private limit: number,
        private workItemUrl: string,
        private showAllArtifacts: boolean,
        private directory:string,
        private forcePush: boolean,
        private branch: string,
        private nopush:boolean,
        private isDryRun: boolean,
        private org?: string
    ) {
        this.org = org?.toLowerCase();
    }

    async exec(): Promise<ReleaseChangelog> {
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

        let git:Git;
        try {
            let artifactFilePaths: Artifact[] = ArtifactFetcher.fetchArtifacts(this.artifactDir);

            if (artifactFilePaths.length === 0) {
                throw new Error(`No artifacts found at ${path.resolve(process.cwd(), this.artifactDir)}`);
            }

            let artifactsToSfpPackage: { [p: string]: SfpPackage } = {};
            let packagesToChangelogFilePaths: { [p: string]: string } = {};
            let artifactSourceBranch: string;
            for (let artifactFilepath of artifactFilePaths) {
                let sfpPackage: SfpPackage = await SfpPackageBuilder.buildPackageFromArtifact(
                    artifactFilepath,
                    new ConsoleLogger()
                );

                artifactsToSfpPackage[sfpPackage.packageName] = sfpPackage;
                packagesToChangelogFilePaths[sfpPackage.packageName] = sfpPackage.changelogFilePath;

                if (artifactSourceBranch == null) {
                    if (sfpPackage.branch) {
                        artifactSourceBranch = sfpPackage.branch;
                    } else {
                        console.log(`${sfpPackage.packageName} artifact is missing branch information`);
                        console.log(
                            `This will cause an error in the future. Re-create the artifact using the latest version of sfpowerscripts to maintain compatibility.`
                        );
                    }
                } 
            }

            if (!artifactSourceBranch) throw new Error('Atleast one artifact must carry branch information');

           
            
            //duplicate repo
            let git=await Git.initiateRepoAtTempLocation(this.logger,null,this.branch);
            SFPLogger.log(`Checking out branch ${this.branch}`,LoggerLevel.INFO,this.logger);

            let pathToChangelogDirectory = this.createDirectory(this.directory, git.getRepositoryPath());

            let releaseChangelog: ReleaseChangelog;
            if (fs.existsSync(path.join(pathToChangelogDirectory, `releasechangelog.json`))) {
                releaseChangelog = JSON.parse(fs.readFileSync(path.join(pathToChangelogDirectory, `releasechangelog.json`), 'utf8'));
            } else {
                releaseChangelog = {
                    orgs: [],
                    releases: [],
                };
            }

            SFPLogger.log('Generating changelog...',LoggerLevel.INFO,this.logger);

            releaseChangelog = new ReleaseChangelogUpdater(
                releaseChangelog,
                this.releaseName,
                artifactsToSfpPackage,
                packagesToChangelogFilePaths,
                this.workItemFilters,
                this.org
            ).update();

            // Preview changelog in console
            SFPLogger.log(
                marked(new ChangelogMarkdownGenerator(releaseChangelog, this.workItemUrl, 1, false).generate()),
                LoggerLevel.INFO,
                this.logger
            );

            fs.writeFileSync(
                path.join(pathToChangelogDirectory, `releasechangelog.json`),
                JSON.stringify(releaseChangelog, null, 4)
            );

            let payload: string = new ChangelogMarkdownGenerator(
                releaseChangelog,
                this.workItemUrl,
                this.limit,
                this.showAllArtifacts
            ).generate();

            fs.writeFileSync(path.join(pathToChangelogDirectory, `Release-Changelog.md`), payload);

            if (!this.isDryRun)
            { 
                await git.commitFile([path.join(pathToChangelogDirectory, `releasechangelog.json`),path.join(pathToChangelogDirectory, `Release-Changelog.md`)]);
                if(!this.nopush)
                  await git.pushToRemote(this.branch,this.forcePush)
            }

            SFPLogger.log(`Successfully generated changelog`,LoggerLevel.INFO,this.logger);
            return releaseChangelog;
        } finally {
           if(git)
             git.deleteTempoRepoIfAny();
        }
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


}
