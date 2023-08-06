import SFPStatsSender from '@dxatscale/sfpowerscripts.core/lib/stats/SFPStatsSender';
import * as rimraf from 'rimraf';
import ProjectValidation from './ProjectValidation';
import * as fs from 'fs-extra';
import SFPLogger, { COLOR_HEADER, ConsoleLogger, LoggerLevel } from '@dxatscale/sfp-logger';
import GroupConsoleLogs from './ui/GroupConsoleLogs';
import { Command, Flags } from '@oclif/core';
import { FlagOutput } from '@oclif/core/lib/interfaces/parser';
import { Org } from '@salesforce/core';


/**
 * A base class that provides common funtionality for sfpowerscripts commands
 *
 * @extends SfdxCommand
 */
export default abstract class SfpowerscriptsCommand extends Command {

    protected static requiresProject: boolean;

    protected hubOrg:Org;
    protected org:Org;
    public flags: FlagOutput & { json: boolean; };

   


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
    protected static requiresUsername: boolean=false;
    protected static requiresDevhubUsername: boolean=false;
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

       

        this.flags = (await this.parse()).flags;

        if(this.statics.flags.targetusername && this.statics.requiresUsername)
        {
            this.org = await Org.create({aliasOrUsername:this.flags.targetusername});
        }


        if(this.statics.flags.targetdevhubusername && this.statics.requiresDevhubUsername)
        {
            this.hubOrg = await Org.create({aliasOrUsername:this.flags.targetdevhubusername});
        }


        this.setLogLevel(this.flags);
        if (this.statics.flags.logsgroupsymbol) {
            GroupConsoleLogs.setLogGroupsSymbol(this.flags.logsgroupsymbol);
        }


        // Setting the environment variable for disabling sfpowerkit header

        if (SFPLogger.logLevel > LoggerLevel.DEBUG) process.env.SFPOWERKIT_NOHEADER = 'true';

        //Set Query Limit to max
        process.env.SF_ORG_MAX_QUERY_LIMIT = '50000';


        this.validateFlags();



        //Clear temp directory before every run
        rimraf.sync('.sfpowerscripts');

        //Initialise StatsD
        this.initializeStatsD();

       
        if (!this.jsonEnabled()) {
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
    protected validateFlags(): void { }


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

    private setLogLevel(flags:FlagOutput) {
        if (flags.loglevel === 'trace' || flags.loglevel === 'TRACE') SFPLogger.logLevel = LoggerLevel.TRACE;
        else if (flags.loglevel === 'debug' || flags.loglevel === 'DEBUG')
            SFPLogger.logLevel = LoggerLevel.DEBUG;
        else if (flags.loglevel === 'info' || flags.loglevel === 'INFO')
            SFPLogger.logLevel = LoggerLevel.INFO;
        else if (flags.loglevel === 'warn' || flags.loglevel === 'WARN')
            SFPLogger.logLevel = LoggerLevel.WARN;
        else if (flags.loglevel === 'error' || flags.loglevel === 'ERROR')
            SFPLogger.logLevel = LoggerLevel.ERROR;
        else if (flags.loglevel === 'fatal' || flags.loglevel === 'FATAL')
            SFPLogger.logLevel = LoggerLevel.FATAL;
        else SFPLogger.logLevel = LoggerLevel.INFO;
    }


    protected get statics(): typeof SfpowerscriptsCommand {
        return this.constructor as typeof SfpowerscriptsCommand;
    }

}
