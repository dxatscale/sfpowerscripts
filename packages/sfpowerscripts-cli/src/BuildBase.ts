import ArtifactGenerator from '@dxatscale/sfpowerscripts.core/lib/artifacts/generators/ArtifactGenerator';

import { EOL } from 'os';
import { flags } from '@salesforce/command';
import SfpowerscriptsCommand from './SfpowerscriptsCommand';
import { Messages } from '@salesforce/core';
import fs = require('fs');
import SFPStatsSender from '@dxatscale/sfpowerscripts.core/lib/stats/SFPStatsSender';
import BuildImpl, { BuildProps } from './impl/parallelBuilder/BuildImpl';
import ProjectConfig from '@dxatscale/sfpowerscripts.core/lib/project/ProjectConfig';
import { Stage } from './impl/Stage';
import SFPLogger, {
    COLOR_ERROR,
    COLOR_HEADER,
    COLOR_INFO,
    COLOR_TIME,
    COLOR_SUCCESS,
    COLOR_KEY_MESSAGE,
    Logger,
    ConsoleLogger,
    LoggerLevel,
    COLOR_KEY_VALUE,
} from '@dxatscale/sfp-logger';
import getFormattedTime from '@dxatscale/sfpowerscripts.core/lib/utils/GetFormattedTime';
import SfpPackage from '@dxatscale/sfpowerscripts.core/lib/package/SfpPackage';
import ReleaseConfig from './impl/release/ReleaseConfig';


// Initialize Messages with the current plugin directory
Messages.importMessagesDirectory(__dirname);

// Load the specific messages for this file. Messages from @salesforce/command, @salesforce/core,
// or any library that is using the messages framework can also be loaded this way.
const messages = Messages.loadMessages('@dxatscale/sfpowerscripts', 'build');

export default abstract class BuildBase extends SfpowerscriptsCommand {
    protected static requiresUsername = false;
    protected static requiresDevhubUsername = false;
    protected static requiresProject = true;

    protected static flagsConfig = {
        diffcheck: flags.boolean({
            description: messages.getMessage('diffCheckFlagDescription'),
            default: false,
        }),
        gittag: flags.boolean({
            description: messages.getMessage('gitTagFlagDescription'),
            hidden: true,
            deprecated: {
                message:'--gittag is deprecated, Please utilize git tags on publish stage',
                messageOverride: '--gittag is deprecated, Please utilize git tags on publish stage',
            },
        }),
        repourl: flags.string({
            char: 'r',
            description: messages.getMessage('repoUrlFlagDescription'),
        }),
        configfilepath: flags.filepath({
            char: 'f',
            description: messages.getMessage('configFilePathFlagDescription'),
            default: 'config/project-scratch-def.json',
        }),
        artifactdir: flags.directory({
            description: messages.getMessage('artifactDirectoryFlagDescription'),
            default: 'artifacts',
        }),
        waittime: flags.number({
            description: messages.getMessage('waitTimeFlagDescription'),
            default: 120,
        }),
        buildnumber: flags.number({
            description: messages.getMessage('buildNumberFlagDescription'),
            default: 1,
        }),
        executorcount: flags.number({
            description: messages.getMessage('executorCountFlagDescription'),
            default: 5,
        }),
        branch: flags.string({
            description: messages.getMessage('branchFlagDescription'),
            required: true,
        }),
        tag: flags.string({
            description: messages.getMessage('tagFlagDescription'),
        }),
        devhubalias: flags.string({
            char: 'v',
            description: messages.getMessage('devhubAliasFlagDescription'),
            default: 'HubOrg',
        }),
        logsgroupsymbol: flags.array({
            char: 'g',
            description: messages.getMessage('logsGroupSymbolFlagDescription'),
        }),
        releaseconfig: flags.string({
            description: messages.getMessage('releaseConfigFileFlagDescription'),
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

    public async execute() {
        let buildExecResult: {
            generatedPackages: SfpPackage[];
            failedPackages: string[];
        };
        let totalElapsedTime: number;
        let artifactCreationErrors: string[] = [];

        let tags = {
            is_diffcheck_enabled: String(this.flags.diffcheck),
            stage: this.getStage(),
            branch: this.flags.branch,
        };
        
        try {
            const artifactDirectory: string = this.flags.artifactdir;
            const diffcheck: boolean = this.flags.diffcheck;
            const branch: string = this.flags.branch;
            // Read Manifest
            let projectConfig = ProjectConfig.getSFDXProjectConfig(process.cwd());

            SFPLogger.log(COLOR_HEADER(`command: ${COLOR_KEY_MESSAGE(this.getStage())}`));
            SFPLogger.log(COLOR_HEADER(`Build Packages Only Changed: ${this.flags.diffcheck}`));
            if(projectConfig?.plugins?.sfpowerscripts?.scratchOrgDefFilePaths?.enableMultiDefinitionFiles){
                SFPLogger.log(COLOR_HEADER(`Multiple Config Files Mode: enabled`));
            }else{
                SFPLogger.log(COLOR_HEADER(`Config File Path: ${this.flags.configfilepath}`));
            }
            SFPLogger.log(COLOR_HEADER(`Artifact Directory: ${this.flags.artifactdir}`));
            SFPLogger.log(
                COLOR_HEADER(
                    `-------------------------------------------------------------------------------------------`
                )
            );

            let executionStartTime = Date.now();


            if (!(this.flags.tag == null || this.flags.tag == undefined)) {
                tags['tag'] = this.flags.tag;
            }



            SFPStatsSender.logCount('build.scheduled', tags);

            let buildProps = this.getBuildProps();

            //Filter Build Props by ReleaseConfig
            buildProps = this.includeOnlyPackagesAsPerReleaseConfig(this.flags.releaseconfig, buildProps, new ConsoleLogger());
            buildExecResult = await this.getBuildImplementer(buildProps).exec();

            if (
                diffcheck &&
                buildExecResult.generatedPackages.length === 0 &&
                buildExecResult.failedPackages.length === 0
            ) {
                SFPLogger.log(`${EOL}${EOL}`);
                SFPLogger.log(COLOR_INFO('No packages found to be built.. Exiting.. '));
                SFPLogger.log(
                    COLOR_HEADER(
                        `----------------------------------------------------------------------------------------------------`
                    )
                );
                throw new Error('No packages to be found to be built');
            }

            SFPLogger.log(`${EOL}${EOL}`);
            SFPLogger.log('Generating Artifacts and Tags....');

            for (let generatedPackage of buildExecResult.generatedPackages) {
                try {
                    await ArtifactGenerator.generateArtifact(generatedPackage, process.cwd(), artifactDirectory);
                } catch (error) {
                    SFPLogger.log(error.message);
                    artifactCreationErrors.push(generatedPackage.packageName);
                }
            }

            totalElapsedTime = Date.now() - executionStartTime;

            if (artifactCreationErrors.length > 0 || buildExecResult.failedPackages.length > 0)
                throw new Error('Build Failed');

            SFPStatsSender.logGauge('build.duration', Date.now() - executionStartTime, tags);

            SFPStatsSender.logCount('build.succeeded', tags);
        } catch (error) {
            SFPStatsSender.logCount('build.failed', tags);
            SFPLogger.log(COLOR_ERROR(error));
            process.exitCode = 1;
        } finally {
            if (buildExecResult?.generatedPackages?.length > 0 || buildExecResult?.failedPackages?.length > 0) {
                SFPLogger.log(
                    COLOR_HEADER(
                        `----------------------------------------------------------------------------------------------------`
                    )
                );
                SFPLogger.log(
                    COLOR_SUCCESS(
                        `${buildExecResult.generatedPackages.length} packages created in ${COLOR_TIME(
                            getFormattedTime(totalElapsedTime)
                        )} minutes with ${COLOR_ERROR(buildExecResult.failedPackages.length)} errors`
                    )
                );

                if (buildExecResult.failedPackages.length > 0)
                    SFPLogger.log(COLOR_ERROR(`Packages Failed To Build`, buildExecResult.failedPackages));

                if (artifactCreationErrors.length > 0)
                    SFPLogger.log(COLOR_ERROR(`Failed To Create Artifacts`, artifactCreationErrors));

                SFPLogger.log(
                    COLOR_HEADER(
                        `----------------------------------------------------------------------------------------------------`
                    )
                );

                const buildResult: BuildResult = {
                    packages: [],
                    summary: {
                        scheduled_packages: null,
                        elapsed_time: null,
                        succeeded: null,
                        failed: null,
                    },
                };

                for (let generatedPackage of buildExecResult.generatedPackages) {
                    buildResult['packages'].push({
                        name: generatedPackage['packageName'],
                        version: generatedPackage['package_version_number'],
                        elapsed_time: generatedPackage['creation_details']?.creation_time,
                        status: 'succeeded',
                    });
                }

                for (let failedPackage of buildExecResult.failedPackages) {
                    buildResult['packages'].push({
                        name: failedPackage,
                        version: null,
                        elapsed_time: null,
                        status: 'failed',
                    });
                }

                buildResult['summary'].scheduled_packages =
                    buildExecResult.generatedPackages.length + buildExecResult.failedPackages.length;
                buildResult['summary'].elapsed_time = totalElapsedTime;
                buildResult['summary'].succeeded = buildExecResult.generatedPackages.length;
                buildResult['summary'].failed = buildExecResult.failedPackages.length;

                fs.writeFileSync(`buildResult.json`, JSON.stringify(buildResult, null, 4));
            }
        }
    }

    private includeOnlyPackagesAsPerReleaseConfig(releaseConfigFilePath:string,buildProps: BuildProps,logger?:Logger): BuildProps {
        if (releaseConfigFilePath) {
        let releaseConfig:ReleaseConfig = new ReleaseConfig(logger, releaseConfigFilePath);
         buildProps.includeOnlyPackages = releaseConfig.getPackagesAsPerReleaseConfig();
         printIncludeOnlyPackages(buildProps.includeOnlyPackages);
        }
        return buildProps;


        function printIncludeOnlyPackages(includeOnlyPackages: string[]) {
            SFPLogger.log(
                COLOR_KEY_MESSAGE(`Build will include the below packages as per inclusive filter`),
                LoggerLevel.INFO
            );
            SFPLogger.log(COLOR_KEY_VALUE(`${includeOnlyPackages.toString()}`), LoggerLevel.INFO);
        }
    }

    abstract getBuildProps(): BuildProps;

    abstract getStage(): Stage;

    abstract getBuildImplementer(buildProps:BuildProps): BuildImpl;
}

interface BuildResult {
    packages: {
        name: string;
        version: string;
        elapsed_time: number;
        status: string;
    }[];
    summary: {
        scheduled_packages: number;
        elapsed_time: number;
        succeeded: number;
        failed: number;
    };
}
