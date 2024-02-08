import { Messages } from '@salesforce/core';
import SfpCommand from '../../SfpCommand';
import ReleaseDefinitionLoader from '../../impl/release/ReleaseDefinitionLoader';
import ProjectConfig from '../../core/project/ProjectConfig';
import GroupConsoleLogs from '../../ui/GroupConsoleLogs';
import FetchImpl from '../../impl/artifacts/FetchImpl';
import ReleaseDefinition from '../../impl/release/ReleaseDefinition';
import path = require('path');
import ArtifactFetcher, { Artifact } from '../../core/artifacts/ArtifactFetcher';
import SfpPackage, { PackageType } from '../../core/package/SfpPackage';
import SfpPackageBuilder from '../../core/package/SfpPackageBuilder';
import SFPLogger, { ConsoleLogger, Logger, LoggerLevel } from '@flxblio/sfp-logger';
import SfpPackageInquirer from '../../core/package/SfpPackageInquirer';
import Git from '../../core/git/Git';
import * as fs from 'fs-extra';
import { COLOR_KEY_MESSAGE } from '@flxblio/sfp-logger';
import { EOL } from 'os';
import { COLOR_WARNING } from '@flxblio/sfp-logger';
import { COLOR_HEADER } from '@flxblio/sfp-logger';
import { Flags } from '@oclif/core';
import { arrayFlagSfdxStyle, loglevel, logsgroupsymbol } from '../../flags/sfdxflags';

Messages.importMessagesDirectory(__dirname);
const messages = Messages.loadMessages('@flxblio/sfp', 'patch');

export default class Patch extends SfpCommand {
    public static description = messages.getMessage('commandDescription');

    public static examples = [`$ sfp repo:patch -n <releaseName>`];

    protected static requiresProject = true;
    protected static requiresDevhubUsername = false;

    public static flags = {
        releasedefinitions: arrayFlagSfdxStyle({
            char: 'p',
            required: true,
            description: messages.getMessage('releaseDefinitionFlagDescription'),
        }),
        sourcebranchname: Flags.string({
            char: 's',
            required: true,
            description: messages.getMessage('sourcebranchNameFlagDescription'),
        }),
        targetbranchname: Flags.string({
            char: 't',
            required: true,
            description: messages.getMessage('targetbranchNameFlagDescription'),
        }),
        scriptpath: Flags.file({
            char: 'f',
            description: messages.getMessage('scriptPathFlagDescription'),
        }),
        npm: Flags.boolean({
            description: messages.getMessage('npmFlagDescription'),
            exclusive: ['scriptpath'],
        }),
        scope: Flags.string({
            description: messages.getMessage('scopeFlagDescription'),
            dependsOn: ['npm'],
            parse: async (scope) => scope.replace(/@/g, '').toLowerCase(),
        }),
        npmrcpath: Flags.file({
            description: messages.getMessage('npmrcPathFlagDescription'),
            dependsOn: ['npm'],
            required: false,
        }),
        logsgroupsymbol,
        loglevel
    };

    async execute(): Promise<any> {
        let git;
        try {
            let logger: Logger = new ConsoleLogger();

            SFPLogger.log(
                COLOR_HEADER(`Source Branch: ${this.flags.sourcebranchname}`),
                LoggerLevel.INFO,
                logger
            );
            SFPLogger.log(
                COLOR_HEADER(`Release Defintion: ${this.flags.releasedefinitions}`),
                LoggerLevel.INFO,
                logger
            );
            SFPLogger.log(
                COLOR_HEADER(`Target Branch: ${this.flags.targetbranchname}`),
                LoggerLevel.INFO,
                logger
            );
            SFPLogger.printHeaderLine('',COLOR_HEADER,LoggerLevel.INFO);

            //Load release definition
            let releaseDefinitions = await this.loadReleaseDefintions(this.flags.releasedefinitions);

            SFPLogger.log(EOL, LoggerLevel.INFO, logger);
            SFPLogger.log(COLOR_WARNING('This process may take a bit of time'), LoggerLevel.INFO, logger);

            //Create temporary git rep
            git = await Git.initiateRepoAtTempLocation(logger, null, this.flags.sourcebranchname);
            await git.createBranch(this.flags.targetbranchname);

            //Fetch artifacts
            await this.fetchArtifacts(
                releaseDefinitions,
                this.flags.scriptpath,
                this.flags.scope,
                this.flags.npmrcpath,
                logger
            );

            //overwrite modules
            await this.overwriteModules(releaseDefinitions, git, logger);

            SFPLogger.log(
                COLOR_KEY_MESSAGE(
                    `Patching of Branch ${this.flags.targetbranchname} with release ${this.flags.releasedefinitions} completed`
                ),
                LoggerLevel.INFO
            );
            SFPLogger.log(COLOR_KEY_MESSAGE(`New Branch with patches created ${this.flags.targetbranchname}`), LoggerLevel.INFO);
        } finally {
            if (git) await git.deleteTempoRepoIfAny();
        }
    }


    private async fetchArtifacts(
        releaseDefintions: ReleaseDefinition[],
        fetchArtifactScript: string,
        scope: string,
        npmrcPath: string,
        logger: Logger
    ) {
        let groupSection = new GroupConsoleLogs('Fetching artifacts').begin();
        SFPLogger.log(COLOR_KEY_MESSAGE('Fetching artifacts'), LoggerLevel.INFO, logger);
        let fetchImpl: FetchImpl = new FetchImpl('artifacts', fetchArtifactScript, scope, npmrcPath, logger);
        await fetchImpl.fetchArtifacts(releaseDefintions);
        groupSection.end();
    }

    private async loadReleaseDefintions(releaseDefinitionPaths: []): Promise<ReleaseDefinition[]> {
        let releaseDefinitions: ReleaseDefinition[] = [];
        for (const pathToReleaseDefintion of releaseDefinitionPaths) {
            let releaseDefinition = await ReleaseDefinitionLoader.loadReleaseDefinition(pathToReleaseDefintion);
            releaseDefinitions.push(releaseDefinition);
        }
        return releaseDefinitions;
    }

    private async overwriteModules(releaseDefinitions: ReleaseDefinition[], git: Git, logger: Logger) {
        let temporaryWorkingDirectory = git.getRepositoryPath();
        let revisedProjectConfig = ProjectConfig.getSFDXProjectConfig(temporaryWorkingDirectory);
        for (const releaseDefinition of releaseDefinitions) {
            let revisedArtifactDirectory = path.join(
                'artifacts',
                releaseDefinition.release.replace(/[/\\?%*:|"<>]/g, '-')
            );

            let artifacts = ArtifactFetcher.fetchArtifacts(revisedArtifactDirectory, null, logger);

            if (artifacts.length === 0) throw new Error(`No artifacts to deploy found in ${revisedArtifactDirectory}`);

            //Convert artifacts to SfpPackages
            let sfpPackages = await this.generateSfpPackageFromArtifacts(artifacts, logger);

            //Grab the latest projectConfig from Packages
            let sfpPackageInquirer: SfpPackageInquirer = new SfpPackageInquirer(sfpPackages, logger);
            let sfdxProjectConfigFromLeadingArtifact = sfpPackageInquirer.getLatestProjectConfig();


            let idx = 0;
            for (const sfpPackage of sfpPackages) {
                SFPLogger.log(`Processing package ${sfpPackage.packageName}`);

                let packageDescriptorFromArtifact=ProjectConfig.getPackageDescriptorFromConfig(
                    sfpPackage.packageName,
                    sfdxProjectConfigFromLeadingArtifact
                );


                //Retrieve the project directory path from the current working directory and remove it
                try {
                    //Find path
                    let pathToPackageInSourceBranch = ProjectConfig.getPackageDescriptorFromConfig(
                        sfpPackage.packageName,
                        revisedProjectConfig
                    ).path;
                    //Remove the path mentioned in the target path
                    fs.removeSync(path.join(temporaryWorkingDirectory, pathToPackageInSourceBranch));
                } catch (error) {
                    //Package not found, do nothing
                }

                //Create new path as mentioned in artifact
                fs.mkdirpSync(path.join(temporaryWorkingDirectory, sfpPackage.packageDirectory));


                 //Copy from artifacts to each package directory
                //If diff, artifact will only contain delta, so use the version control to checkout the entire reference
                if(sfpPackage.packageType==PackageType.Diff)
                {

                    await git.checkoutPath(sfpPackage.commitSHATo, sfpPackage.packageDirectory);
                }
                else
                {
                    fs.copySync(
                        path.join(sfpPackage.sourceDir, sfpPackage.packageDirectory),
                        path.join(temporaryWorkingDirectory, sfpPackage.packageDirectory)
                    );
                }

                SFPLogger.log(
                    COLOR_KEY_MESSAGE(
                        `Succesfully copied from artifact ${sfpPackage.packageName} ${sfpPackage.package_version_number} to target directory`
                    ),
                    LoggerLevel.INFO
                );

                //Find package index and replace the descriptor from the artifact
                let packageIndex = this.getPackageIndex(sfpPackage.packageName, revisedProjectConfig);
                if (packageIndex != -1) {
                    revisedProjectConfig.packageDirectories = revisedProjectConfig.packageDirectories.map(
                        (sfdxPackage) => {
                            if (sfdxPackage.package == sfpPackage.packageName) {
                                delete packageDescriptorFromArtifact.default;
                                return packageDescriptorFromArtifact;
                            } else {
                                return sfdxPackage;
                            }
                        }
                    );
                } else {
                    //Package is not in the source branch, so  find an anchor package
                    let currentIdx = idx--;
                    while (true) {
                        if ((currentIdx = -1)) {
                            //There is no package above me to anchor. so just add it 0
                            revisedProjectConfig.packageDirectories.splice(
                                0,
                                0,
                                packageDescriptorFromArtifact
                            );
                        } else {
                            packageIndex = this.getPackageIndex(
                                sfpPackages[currentIdx].packageName,
                                revisedProjectConfig
                            );
                            if (packageIndex >= 0) {
                                revisedProjectConfig.packageDirectories.splice(
                                    packageIndex,
                                    0,
                                    packageDescriptorFromArtifact
                                );
                            } else currentIdx--;
                        }
                    }
                }
                //Write sfdx project.json immediately
                fs.writeJSONSync(
                    path.join(temporaryWorkingDirectory, 'sfdx-project.json'),
                    revisedProjectConfig,
                    {
                        spaces: 4,
                    }
                );

                //Commit to git
                try {
                    await git.commitFile(
                        [sfpPackage.packageDescriptor.path, 'sfdx-project.json'],
                        `Reset ${sfpPackage.packageName} to ${sfpPackage.package_version_number}`
                    );
                    await git.addAnnotatedTag(`${sfpPackage.packageName}_v${sfpPackage.package_version_number}-ALIGN`,
                     `${sfpPackage.packageName} ${sfpPackage.packageType} Package ${sfpPackage.package_version_number}`);
                } catch (error) {
                    //Ignore
                }

                SFPLogger.log(
                    COLOR_KEY_MESSAGE(`Processed ${sfpPackage.packageName} to ${sfpPackage.package_version_number}`),
                    LoggerLevel.INFO
                );

                idx++;
            }
            SFPLogger.log('Packages' + sfpPackages.length, LoggerLevel.TRACE, logger);
        }
        //Push back
        await git.pushToRemote(this.flags.targetbranchname, true);
        await git.pushTags();
    }

    private async generateSfpPackageFromArtifacts(artifacts: Artifact[], logger: Logger): Promise<SfpPackage[]> {
        let sfpPackages: SfpPackage[] = [];
        for (const artifact of artifacts) {
            let sfpPackage = await SfpPackageBuilder.buildPackageFromArtifact(artifact, logger);
            sfpPackages.push(sfpPackage);
        }
        return sfpPackages;
    }

    private getPackageIndex(sfdxPackage: string, projectConfig: any) {
        return projectConfig.packageDirectories.find((packageDescriptor) => packageDescriptor.package == sfdxPackage);
    }
}
