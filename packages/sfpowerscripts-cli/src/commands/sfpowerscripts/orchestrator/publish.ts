import { flags } from '@salesforce/command';
import SfpowerscriptsCommand from '../../../SfpowerscriptsCommand';
import { Messages } from '@salesforce/core';
import * as fs from 'fs-extra';
import path = require('path');
import ArtifactFetcher, { Artifact } from '@dxatscale/sfpowerscripts.core/lib/artifacts/ArtifactFetcher';
import SFPStatsSender from '@dxatscale/sfpowerscripts.core/lib/stats/SFPStatsSender';
import SFPLogger, {
    COLOR_ERROR,
    COLOR_HEADER,
    COLOR_KEY_MESSAGE,
    COLOR_SUCCESS,
    COLOR_TIME,
} from '@dxatscale/sfp-logger';
import getFormattedTime from '@dxatscale/sfpowerscripts.core/lib/utils/GetFormattedTime';
import defaultShell from '@dxatscale/sfpowerscripts.core/lib/utils/DefaultShell';
import SfpPackage, { PackageType } from '@dxatscale/sfpowerscripts.core/lib/package/SfpPackage';
import { ConsoleLogger } from '@dxatscale/sfp-logger';
import SfpPackageBuilder from '@dxatscale/sfpowerscripts.core/lib/package/SfpPackageBuilder';
import Git from '@dxatscale/sfpowerscripts.core/lib/git/Git';
import GroupConsoleLogs from '../../../ui/GroupConsoleLogs';
import PackageVersionLister from '@dxatscale/sfpowerscripts.core/lib/package/version/PackageVersionLister';
import SFPOrg from '@dxatscale/sfpowerscripts.core/lib/org/SFPOrg';
import ExecuteCommand from '@dxatscale/sfdx-process-wrapper/lib/commandExecutor/ExecuteCommand';
import { LoggerLevel } from '@dxatscale/sfp-logger';
import GitTags from '@dxatscale/sfpowerscripts.core/lib/git/GitTags';

Messages.importMessagesDirectory(__dirname);
const messages = Messages.loadMessages('@dxatscale/sfpowerscripts', 'publish');

export default class Promote extends SfpowerscriptsCommand {
    public static description = messages.getMessage('commandDescription');

    public static examples = [
        `$ sfdx sfpowerscripts:orchestrator:publish -f path/to/script`,
        `$ sfdx sfpowerscripts:orchestrator:publish --npm`,
        `$ sfdx sfpowerscripts:orchestrator:publish -f path/to/script -p -v HubOrg`,
        `$ sfdx sfpowerscripts:orchestrator:publish -f path/to/script --gittag --pushgittag`,
    ];

    protected static requiresUsername = false;
    protected static requiresDevhubUsername = false;

    protected static flagsConfig = {
        artifactdir: flags.directory({
            required: true,
            char: 'd',
            description: messages.getMessage('artifactDirectoryFlagDescription'),
            default: 'artifacts',
        }),
        publishpromotedonly: flags.boolean({
            char: 'p',
            description: messages.getMessage('publishPromotedOnlyFlagDescription'),
            dependsOn: ['devhubalias'],
        }),
        devhubalias: flags.string({
            char: 'v',
            description: messages.getMessage('devhubAliasFlagDescription'),
        }),
        scriptpath: flags.filepath({
            char: 'f',
            description: messages.getMessage('scriptPathFlagDescription'),
        }),
        tag: flags.string({
            char: 't',
            description: messages.getMessage('tagFlagDescription'),
        }),
        gittag: flags.boolean({
            description: messages.getMessage('gitTagFlagDescription'),
            default: false,
        }),
        gittaglimit: flags.number({
            description: messages.getMessage('gitTagLimitFlagDescription'),
        }),
        gittagage: flags.number({
            description: messages.getMessage('gitTagAgeFlagDescription'),
        }),
        pushgittag: flags.boolean({
            description: messages.getMessage('gitPushTagFlagDescription'),
            default: false,
        }),
        npm: flags.boolean({
            description: messages.getMessage('npmFlagDescription'),
            exclusive: ['scriptpath'],
        }),
        scope: flags.string({
            description: messages.getMessage('scopeFlagDescription'),
            dependsOn: ['npm'],
            parse: async (scope) => scope.replace(/@/g, '').toLowerCase(),
        }),
        npmtag: flags.string({
            description: messages.getMessage('npmTagFlagDescription'),
            dependsOn: ['npm'],
            required: false,
            deprecated: {
                message:
                    '--npmtag is deprecated, sfpowerscripts will automatically tag the artifact with the branch name',
                messageOverride:
                    '--npmtag is deprecated, sfpowerscripts will automatically tag the artifact with the branch name',
            },
        }),
        npmrcpath: flags.filepath({
            description: messages.getMessage('npmrcPathFlagDescription'),
            dependsOn: ['npm'],
            required: false,
        }),
        logsgroupsymbol: flags.array({
            char: 'g',
            description: messages.getMessage('logsGroupSymbolFlagDescription'),
        }),
        loglevel: flags.enum({
            description: 'logging level for this command invocation',
            default: 'info',
            required: false,
            options: [
                'trace',
                'debug',
                'info',
                'warn',
                'error',
                'fatal',
                'TRACE',
                'DEBUG',
                'INFO',
                'WARN',
                'ERROR',
                'FATAL',
            ],
        }),
    };
    private git: Git;

    public async execute() {
        let nPublishedArtifacts: number = 0;
        let failedArtifacts: string[] = [];

        let executionStartTime = Date.now();

        let succesfullyPublishedPackageNamesForTagging: {
            name: string;
            version: string;
            type: string;
            tag: string;
            commitId: string;
        }[] = [];

        let npmrcFilesToCleanup: string[] = [];
        this.git = await Git.initiateRepo(new ConsoleLogger());

        try {
            SFPLogger.log(COLOR_HEADER(`command: ${COLOR_KEY_MESSAGE(`publish`)}`));
            SFPLogger.log(COLOR_HEADER(`target: ${this.flags.scriptpath ? this.flags.scriptpath : 'NPM'}`));
            SFPLogger.log(
                COLOR_HEADER(`Publish promoted artifacts only: ${this.flags.publishpromotedonly ? true : false}`)
            );
            SFPLogger.log(
                COLOR_HEADER(
                    `-------------------------------------------------------------------------------------------`
                )
            );
            let packageVersionList: any;
            if (this.flags.publishpromotedonly) {
                let hubOrg = await SFPOrg.create({ aliasOrUsername: this.flags.devhubalias });
                let packageVersionLister: PackageVersionLister = new PackageVersionLister(hubOrg);
                packageVersionList = await packageVersionLister.listAllReleasedVersions(process.cwd());
            }

            let artifacts = ArtifactFetcher.findArtifacts(this.flags.artifactdir);
            let artifactFilePaths = ArtifactFetcher.fetchArtifacts(this.flags.artifactdir);

            // Pattern captures two named groups, the "package" name and "version" number
            let pattern = new RegExp('(?<package>^.*)(?:_sfpowerscripts_artifact_)(?<version>.*)(?:\\.zip)');
            for (let artifact of artifacts) {
                let packageName: string;
                let packageVersionNumber: string;

                let match: RegExpMatchArray = path.basename(artifact).match(pattern);

                if (match !== null) {
                    packageName = match.groups.package;
                    packageVersionNumber = match.groups.version;
                } else {
                    // artifact filename doesn't match pattern
                    continue;
                }

                let sfpPackage = await this.getPackageInfo(artifactFilePaths, packageName, packageVersionNumber);

                let packageType = sfpPackage.package_type;
                let packageVersionId = sfpPackage.package_version_id;

                if (this.flags.publishpromotedonly && packageType === PackageType.Unlocked) {
                    let isReleased = this.isPackageVersionIdReleased(packageVersionList, packageVersionId);

                    if (!isReleased) {
                        failedArtifacts.push(`${packageName} v${packageVersionNumber}`);
                        SFPLogger.log(
                            `Skipping ${packageName} Version ${packageVersionNumber}. Package Version Id ${packageVersionId} has not been promoted.`
                        );
                        process.exitCode = 1;
                        continue;
                    }
                }

                try {
                    if (this.flags.npm) {
                        await this.publishUsingNpm(sfpPackage, packageVersionNumber, npmrcFilesToCleanup);
                    } else {
                        await this.publishUsingScript(packageName, packageVersionNumber, artifact);
                    }

                    succesfullyPublishedPackageNamesForTagging.push({
                        name: packageName,
                        version: packageVersionNumber.replace('-', '.'),
                        type: packageType,
                        tag: `${packageName}_v${packageVersionNumber.replace('-', '.')}`,
                        commitId: sfpPackage.sourceVersion
                    });

                    nPublishedArtifacts++;
                } catch (err) {
                    failedArtifacts.push(`${packageName} v${packageVersionNumber}`);
                    SFPLogger.log(err.message);
                    process.exitCode = 1;
                }
            }

            if (this.flags.gittag) {
                await this.createGitTags(succesfullyPublishedPackageNamesForTagging);
                await this.pushGitTags(succesfullyPublishedPackageNamesForTagging);
            }


            if (this.flags.gittagage && this.flags.gittaglimit) {
                await this.deleteGitTagsOlderThan(succesfullyPublishedPackageNamesForTagging, this.flags.gittagage, this.flags.gittaglimit);
            } else if (this.flags.gittagage) {
                await this.deleteGitTagsOlderThan(succesfullyPublishedPackageNamesForTagging, this.flags.gittagage);
            } else if (this.flags.gittaglimit) {
                await this.deleteExcessGitTags(succesfullyPublishedPackageNamesForTagging, this.flags.gittaglimit);
            }


        } catch (err) {
            SFPLogger.log(err.message);

            // Fail the task when an error occurs
            process.exitCode = 1;
        } finally {
            if (npmrcFilesToCleanup.length > 0) {
                npmrcFilesToCleanup.forEach((npmrcFile) => {
                    fs.unlinkSync(npmrcFile);
                });
            }

            let totalElapsedTime: number = Date.now() - executionStartTime;

            SFPLogger.log(
                COLOR_HEADER(
                    `----------------------------------------------------------------------------------------------------`
                )
            );
            SFPLogger.log(
                COLOR_SUCCESS(
                    `${nPublishedArtifacts} artifacts published in ${COLOR_TIME(
                        getFormattedTime(totalElapsedTime)
                    )} with {${COLOR_ERROR(failedArtifacts.length)}} errors`
                )
            );

            if (failedArtifacts.length > 0) {
                SFPLogger.log(COLOR_ERROR(`Packages Failed to Publish`, failedArtifacts));
            }
            SFPLogger.log(
                COLOR_HEADER(
                    `----------------------------------------------------------------------------------------------------`
                )
            );

            let tags = {
                publish_promoted_only: this.flags.publishpromotedonly ? 'true' : 'false',
            };

            if (this.flags.tag != null) {
                tags['tag'] = this.flags.tag;
            }

            SFPStatsSender.logGauge('publish.duration', totalElapsedTime, tags);

            SFPStatsSender.logGauge('publish.succeeded', nPublishedArtifacts, tags);

            if (failedArtifacts.length > 0) {
                SFPStatsSender.logGauge('publish.failed', failedArtifacts.length, tags);
            }
        }
    }

    private async publishUsingNpm(sfpPackage: SfpPackage, packageVersionNumber: string, npmrcFilesToCleanup: string[]) {
        let publishGroupSection = new GroupConsoleLogs(`Publishing ${sfpPackage.packageName}`).begin();
        let artifactRootDirectory = path.dirname(sfpPackage.sourceDir);

        // NPM does not accept packages with uppercase characters
        let name: string = sfpPackage.packageName.toLowerCase() + '_sfpowerscripts_artifact';

        //Check whether the user has already passed in @

        if (this.flags.scope) {
            let scope: string = this.flags.scope.replace(/@/g, '').toLowerCase();
            name = `@${scope}/` + name;
        }

        let packageJson = {
            name: name,
            version: packageVersionNumber,
            repository: sfpPackage.repository_url,
        };

        fs.writeFileSync(path.join(artifactRootDirectory, 'package.json'), JSON.stringify(packageJson, null, 4));

        if (this.flags.npmrcpath) {
            fs.copyFileSync(this.flags.npmrcpath, path.join(artifactRootDirectory, '.npmrc'));

            npmrcFilesToCleanup.push(path.join(artifactRootDirectory, '.npmrc'));
        }

        let cmd = `npm publish`;

        //Do a tag based on the branch
        if (sfpPackage.branch) {
            cmd += ` --tag ${sfpPackage.branch}`;
            SFPLogger.log(
                COLOR_KEY_MESSAGE(
                    `Publishing ${sfpPackage.packageName} Version ${packageVersionNumber} with tag ${sfpPackage.branch}...`
                )
            );
        }

        let npmPublishExecutor: ExecuteCommand = new ExecuteCommand(new ConsoleLogger(), LoggerLevel.INFO, true);
        await npmPublishExecutor.execCommand(cmd, artifactRootDirectory);

        publishGroupSection.end();
    }

    private async publishUsingScript(packageName: string, packageVersionNumber: string, artifact: string) {
        let publishGroupSection = new GroupConsoleLogs(`Publishing ${packageName}`).begin();
        let cmd: string;
        if (process.platform !== 'win32') {
            cmd = `${defaultShell()} -e ${this.flags.scriptpath} ${packageName} ${packageVersionNumber} ${artifact} ${
                this.flags.publishpromotedonly ? true : false
            }`;
        } else {
            cmd = `cmd.exe /c ${this.flags.scriptpath} ${packageName} ${packageVersionNumber} ${artifact} ${
                this.flags.publishpromotedonly ? true : false
            }`;
        }

        SFPLogger.log(COLOR_KEY_MESSAGE(`Publishing ${packageName} Version ${packageVersionNumber}...`));

        let scriptExecutor: ExecuteCommand = new ExecuteCommand(new ConsoleLogger(), LoggerLevel.INFO, true);
        await scriptExecutor.execCommand(cmd, process.cwd());
        publishGroupSection.end();
    }

    protected validateFlags() {
        if (this.flags.scriptpath === undefined && this.flags.npm === undefined)
            throw new Error('Either --scriptpath or --npm flag must be provided');

        if (this.flags.scriptpath && !fs.existsSync(this.flags.scriptpath))
            throw new Error(`Script path ${this.flags.scriptpath} does not exist`);

        if (this.flags.npm && !this.flags.scope) throw new Error('--scope parameter is required for NPM');
    }

    private async pushGitTags(
        sucessfullyPublishedPackages: {
            name: string;
            version: string;
            type: string;
            tag: string;
            commitId: string;
        }[]
    ) {

        if (this.flags.pushgittag) {
            let tagsForPushing:string[]=[];
            for (let succesfullyPublishedPackage of sucessfullyPublishedPackages) {
                SFPLogger.log(COLOR_KEY_MESSAGE(`Pushing Git Tags to Repo ${succesfullyPublishedPackage.tag}`));
                tagsForPushing.push(succesfullyPublishedPackage.tag);
            }
            await this.git.pushTags(tagsForPushing)
        }
    }

    private async createGitTags(
        sucessfullyPublishedPackages: {
            name: string;
            version: string;
            type: string;
            tag: string;
            commitId: string;
        }[]
    ) {

        for (let sucessFullyPublishedPackage of sucessfullyPublishedPackages) {
            SFPLogger.log(COLOR_KEY_MESSAGE(`Creating Git Tags in Repo ${sucessFullyPublishedPackage.tag}`));
            await this.git.addAnnotatedTag(
                sucessFullyPublishedPackage.tag,
                `${sucessFullyPublishedPackage.name} ${sucessFullyPublishedPackage.type} Package ${sucessFullyPublishedPackage.version}`,
                sucessFullyPublishedPackage.commitId
            );
        }
    }

    //Exclude the latest git tag up to a specified number of tags, and then deletes the excess tags that exceed that limit.
    private async deleteExcessGitTags( tags: {
        name: string;
        version: string;
        type: string;
        tag: string;
        commitId: string;
    }[], limit: number) {
            //const pkgs = ProjectConfig.getAllPackages(this.git.getRepositoryPath());
            const tagsToDelete: string[] = [];

            await Promise.all(tags.map(async (tag) => {
                const gitTags = new GitTags(this.git, tag.name);
                const tags = await gitTags.limitTags(limit);
                tagsToDelete.push(...tags);
              }));

              if (tagsToDelete.length > 0) {
                SFPLogger.log(COLOR_KEY_MESSAGE('Removing the following Git tag(s):'));
                for (let tag of tagsToDelete) {
                    SFPLogger.log(COLOR_KEY_MESSAGE(tag));
                }
                await this.git.deleteTags(tagsToDelete);
            }
        }

    //Deletes Git tags that are older than a specified number of days.
    private async deleteGitTagsOlderThan( tags: {
        name: string;
        version: string;
        type: string;
        tag: string;
        commitId: string;
    }[], daysToKeep: number
    , limit?: number) {
       
        const tagsToDelete: string[] = [];

        await Promise.all(tags.map(async (tag) => {
            const gitTags = new GitTags(this.git, tag.name);
            const tags = await gitTags.filteredOldTags(daysToKeep, limit);
            tagsToDelete.push(...tags);
          }));

          if (tagsToDelete.length > 0) {
            SFPLogger.log(COLOR_KEY_MESSAGE('Removing the following Git tag(s):'));
            for (let tag of tagsToDelete) {
                SFPLogger.log(COLOR_KEY_MESSAGE(tag));
            }
            await this.git.deleteTags(tagsToDelete);
        }

    }


    private isPackageVersionIdReleased(packageVersionList: any, packageVersionId: string): boolean {
        let packageVersion = packageVersionList.find((pkg) => {
            return pkg.SubscriberPackageVersionId === packageVersionId;
        });

        if (packageVersion) return true;
        else return false;
    }

    /**
     * Get sourceDirectory and packageMetadata of artifact with package name and version
     * @param artifacts
     * @param packageName
     * @param packageVersionNumber
     */
    private async getPackageInfo(artifacts: Artifact[], packageName, packageVersionNumber): Promise<SfpPackage> {
        for (let artifact of artifacts) {
            let sfpPackage = await SfpPackageBuilder.buildPackageFromArtifact(artifact, new ConsoleLogger());
            if (
                sfpPackage.packageName === packageName &&
                sfpPackage.versionNumber === packageVersionNumber.replace('-', '.')
            ) {
                return sfpPackage;
            }
        }

        throw new Error(
            `Unable to find artifact metadata for ${packageName} Version ${packageVersionNumber.replace('-', '.')}`
        );
    }
}
