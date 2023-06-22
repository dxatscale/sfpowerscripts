import { SfdxCommand } from '@salesforce/command';
import SFPStatsSender from '@dxatscale/sfpowerscripts.core/lib/stats/SFPStatsSender';
import * as rimraf from 'rimraf';
import ProjectValidation from './ProjectValidation';
import DemoReelPlayer from './impl/demoreelplayer/DemoReelPlayer';
import * as fs from 'fs-extra';
import SFPLogger, { COLOR_HEADER, ConsoleLogger, LoggerLevel } from '@dxatscale/sfp-logger';
import { OutputFlags } from '@oclif/core/lib/interfaces';
import GroupConsoleLogs from './ui/GroupConsoleLogs';

/**
 * A base class that provides common funtionality for sfpowerscripts commands
 *
 * @extends SfdxCommand
 */
export default abstract class SfpowerscriptsCommand extends SfdxCommand {
    /**
     * List of recognised CLI inputs that are substituted with their
     * corresponding environment variable at runtime
     */
    private readonly sfpowerscripts_variable_dictionary: string[] = [
        'sfpowerscripts_incremented_project_version',
        'sfpowerscripts_artifact_directory',
        'sfpowerscripts_artifact_metadata_directory',
        'sfpowerscripts_package_version_id',
        'sfpowerscripts_package_version_number',
        'sfpowerscripts_pmd_output_path',
        'sfpowerscripts_scratchorg_username',
        'sfpowerscripts_installsourcepackage_deployment_id',
    ];

    private isSfpowerkitFound: boolean;
    private sfpowerscriptsConfig;
    private isSfdmuFound: boolean;
    /**
     * Command run code goes here
     */
    abstract execute(): Promise<any>;

    /**
     * Entry point of all commands
     */
    async run(): Promise<any> {
        //Always enable color by default
        if (process.env.SFPOWERSCRIPTS_NOCOLOR) SFPLogger.disableColor();
        else SFPLogger.enableColor();

        this.setLogLevel();

        if (this.flags.logsgroupsymbol) {
            GroupConsoleLogs.setLogGroupsSymbol(this.flags.logsgroupsymbol);
        }

        if (this.flags.json) {
            SFPLogger.disableLogs();
        }

        // Setting the environment variable for disabling sfpowerkit header

        if (SFPLogger.logLevel > LoggerLevel.DEBUG) process.env.SFPOWERKIT_NOHEADER = 'true';

        //Set Query Limit to max
        process.env.SF_ORG_MAX_QUERY_LIMIT = '50000';

        //If demo mode, display demo reel and return
        if (process.env.SFPOWERSCRIPTS_DEMO_MODE) {
            await this.executeDemoMode();
            return;
        }

        this.loadSfpowerscriptsVariables(this.flags);

        this.validateFlags();

       

        //Clear temp directory before every run
        rimraf.sync('.sfpowerscripts');

        //Initialise StatsD
        this.initializeStatsD();

       
        if (!this.flags.json) {
            SFPLogger.log(
                COLOR_HEADER(
                    `-------------------------------------------------------------------------------------------`
                )
            );
            SFPLogger.log(
                COLOR_HEADER(
                    `sfpowerscripts  -- The DX@Scale CI/CD Orchestrator -Version:${this.config.version} -Release:${this.config.pjson.release}`
                )
            );

            SFPLogger.log(
                COLOR_HEADER(
                    `-------------------------------------------------------------------------------------------`
                )
            );
        }

        if (this.statics.requiresProject) {
            let projectValidation = new ProjectValidation();
            projectValidation.validateSFDXProjectJSON();
            projectValidation.validatePackageNames();
        }


        // Execute command run code
        return await this.execute();
    }

    /**
     * Optional method for programmatically validating flags.
     * Useful for complex flag behaviours that cannot be adequately defined using flag props
     * e.g. making a flag required only if another flag that it depends on is passed
     */
    protected validateFlags(): void {}

    /**
     * Substitutes CLI inputs, that match the variable dictionary, with
     * the corresponding environment variable
     *
     * @param flags
     */
    private loadSfpowerscriptsVariables(flags: OutputFlags<any>): void {
        require('dotenv').config();

        for (let flag in flags) {
            for (let sfpowerscripts_variable of this.sfpowerscripts_variable_dictionary) {
                if (typeof flags[flag] === 'string' && flags[flag].includes(sfpowerscripts_variable)) {
                    console.log(`Substituting ${flags[flag]} with ${process.env[flags[flag]]}`);
                    flags[flag] = process.env[flags[flag]];
                    break;
                }
            }
        }
    }

    private initializeStatsD() {
        if (process.env.SFPOWERSCRIPTS_STATSD) {
            SFPStatsSender.initialize(
                process.env.SFPOWERSCRIPTS_STATSD_PORT,
                process.env.SFPOWERSCRIPTS_STATSD_HOST,
                process.env.SFPOWERSCRIPTS_STATSD_PROTOCOL
            );
        }
        if (process.env.SFPOWERSCRIPTS_DATADOG) {
            SFPStatsSender.initializeNativeMetrics(
                'DataDog',
                process.env.SFPOWERSCRIPTS_DATADOG_HOST,
                process.env.SFPOWERSCRIPTS_DATADOG_API_KEY,
                new ConsoleLogger()
            );
        } else if (process.env.SFPOWERSCRIPTS_NEWRELIC) {
            SFPStatsSender.initializeNativeMetrics(
                'NewRelic',
                null,
                process.env.SFPOWERSCRIPTS_NEWRELIC_API_KEY,
                new ConsoleLogger()
            );
        } else if (process.env.SFPOWERSCRIPTS_SPLUNK) {
            SFPStatsSender.initializeNativeMetrics(
                'Splunk',
                process.env.SFPOWERSCRIPTS_SPLUNK_HOST,
                process.env.SFPOWERSCRIPTS_SPLUNK_API_KEY,
                new ConsoleLogger()
            );
        }

        SFPStatsSender.initializeLogBasedMetrics();
    }

    private setLogLevel() {
        if (this.flags.loglevel === 'trace' || this.flags.loglevel === 'TRACE') SFPLogger.logLevel = LoggerLevel.TRACE;
        else if (this.flags.loglevel === 'debug' || this.flags.loglevel === 'DEBUG')
            SFPLogger.logLevel = LoggerLevel.DEBUG;
        else if (this.flags.loglevel === 'info' || this.flags.loglevel === 'INFO')
            SFPLogger.logLevel = LoggerLevel.INFO;
        else if (this.flags.loglevel === 'warn' || this.flags.loglevel === 'WARN')
            SFPLogger.logLevel = LoggerLevel.WARN;
        else if (this.flags.loglevel === 'error' || this.flags.loglevel === 'ERROR')
            SFPLogger.logLevel = LoggerLevel.ERROR;
        else if (this.flags.loglevel === 'fatal' || this.flags.loglevel === 'FATAL')
            SFPLogger.logLevel = LoggerLevel.FATAL;
        else SFPLogger.logLevel = LoggerLevel.INFO;
    }

    private async executeDemoMode() {
        if (fs.existsSync(process.env.SFPOWERSCRIPTS_DEMOREEL_FOLDER_PATH)) {
            let player: DemoReelPlayer = new DemoReelPlayer();
            await player.execute(process.env.SFPOWERSCRIPTS_DEMOREEL_FOLDER_PATH);
        } else {
            console.log('Demo reel doesnt exist, Please check the path and try again');
        }
    }
}
