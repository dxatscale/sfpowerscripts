import { Messages, SfdxError } from '@salesforce/core';
import SfpowerscriptsCommand from '../../SfpowerscriptsCommand';
import { flags } from '@salesforce/command';
import PrepareImpl from '../../impl/prepare/PrepareImpl';
import SFPStatsSender from '@dxatscale/sfpowerscripts.core/lib/stats/SFPStatsSender';
import { Stage } from '../../impl/Stage';
import * as fs from 'fs-extra';
import ScratchOrgInfoFetcher from '@dxatscale/sfpowerscripts.core/lib/scratchorg/pool/services/fetchers/ScratchOrgInfoFetcher';
import Ajv from 'ajv';
import path = require('path');
import { PoolErrorCodes } from '@dxatscale/sfpowerscripts.core/lib/scratchorg/pool/PoolError';
import SFPLogger, {
    LoggerLevel,
    COLOR_ERROR,
    COLOR_HEADER,
    COLOR_SUCCESS,
    COLOR_TIME,
    COLOR_KEY_MESSAGE,
} from '@dxatscale/sfp-logger';
import getFormattedTime from '@dxatscale/sfpowerscripts.core/lib/utils/GetFormattedTime';
import { PoolConfig } from '@dxatscale/sfpowerscripts.core/lib/scratchorg/pool/PoolConfig';
import { COLOR_WARNING } from '@dxatscale/sfp-logger';
import * as PoolSchema from '@dxatscale/sfpowerscripts.core/resources/pooldefinition.schema.json'; //create namespace to import schema via npm link
import SFPOrg from '@dxatscale/sfpowerscripts.core/lib/org/SFPOrg';
import { PrepareStreamService } from '@dxatscale/sfpowerscripts.core/lib/eventStream/prepare';

Messages.importMessagesDirectory(__dirname);
const messages = Messages.loadMessages('@dxatscale/sfpowerscripts', 'prepare');

export default class Prepare extends SfpowerscriptsCommand {
    protected static requiresDevhubUsername = true;
    protected static requiresProject = true;

    protected static flagsConfig = {
        poolconfig: flags.filepath({
            required: false,
            default: 'config/poolconfig.json',
            char: 'f',
            description: messages.getMessage('poolConfigFlagDescription'),
        }),
        npmrcpath: flags.filepath({
            description: messages.getMessage('npmrcPathFlagDescription'),
            required: false,
        }),
        keys: flags.string({
            required: false,
            description: messages.getMessage('keysDescription'),
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

    public static description = messages.getMessage('commandDescription');

    public static examples = [`$ sfpowerscripts orchestrator:prepare -f config/mypoolconfig.json  -v <devhub>`];

    public async execute(): Promise<any> {
        let executionStartTime = Date.now();

        PrepareStreamService.startServer();

        SFPLogger.log(COLOR_HEADER(`command: ${COLOR_KEY_MESSAGE(`prepare`)}`));

        //Read pool config
        try {
            let poolConfig: PoolConfig = fs.readJSONSync(this.flags.poolconfig);
            this.validatePoolConfig(poolConfig);
            //Assign Keys to the config
            if (this.flags.keys) poolConfig.keys = this.flags.keys;

            this.displayHeader(poolConfig);

            //Assign npmrcPath to the config
            if (this.flags.npmrcpath) {
                if (poolConfig.fetchArtifacts?.npm) poolConfig.fetchArtifacts.npm.npmrcPath = this.flags.npmrcpath;
                else
                    SFPLogger.log(
                        COLOR_WARNING(
                            'npmrcPath found in flag, however the configuration doesnt seem to use npm, Are you sure your schema is good?'
                        )
                    );
            }

            let tags = {
                stage: Stage.PREPARE,
                poolName: poolConfig.tag,
            };

            await this.hubOrg.refreshAuth();
            const hubConn = this.hubOrg.getConnection();

            this.flags.apiversion = this.flags.apiversion || (await hubConn.retrieveMaxApiVersion());

            let hubOrgAsSfPOrg = await SFPOrg.create({ connection: this.hubOrg.getConnection() });
            let prepareImpl = new PrepareImpl(hubOrgAsSfPOrg, poolConfig, this.flags.loglevel);

            let results = await prepareImpl.exec();
            if (results.isOk()) {
                let totalElapsedTime = Date.now() - executionStartTime;
                SFPLogger.log(
                    COLOR_HEADER(
                        `-----------------------------------------------------------------------------------------------------------`
                    )
                );
                SFPLogger.log(
                    COLOR_SUCCESS(
                        `Provisioned {${results.value.scratchOrgs.length}}  scratchorgs out of ${
                            results.value.to_allocate
                        } requested with ${COLOR_ERROR(results.value.failedToCreate)} failed in ${COLOR_TIME(
                            getFormattedTime(totalElapsedTime)
                        )} `
                    )
                );
                SFPLogger.log(
                    COLOR_HEADER(
                        `----------------------------------------------------------------------------------------------------------`
                    )
                );

                await this.getCurrentRemainingNumberOfOrgsInPoolAndReport(poolConfig);

                SFPStatsSender.logGauge('prepare.succeededorgs', results.value.scratchOrgs.length, tags);
                if (results.value.scratchOrgs.length > 0)
                    SFPStatsSender.logGauge('prepare.duration', Date.now() - executionStartTime, tags);
            } else if (results.isErr()) {
                SFPLogger.log(
                    COLOR_HEADER(
                        `-----------------------------------------------------------------------------------------------------------`
                    )
                );
                SFPLogger.log(COLOR_ERROR(results.error.message), LoggerLevel.ERROR);
                SFPLogger.log(
                    COLOR_HEADER(
                        `-----------------------------------------------------------------------------------------------------------`
                    )
                );

                switch (results.error.errorCode) {
                    case PoolErrorCodes.Max_Capacity:
                        process.exitCode = 0;
                        break;
                    case PoolErrorCodes.No_Capacity:
                        process.exitCode = 0;
                        break;
                    case PoolErrorCodes.PrerequisiteMissing:
                        process.exitCode = 1;
                        break;
                    case PoolErrorCodes.UnableToProvisionAny:
                        SFPStatsSender.logGauge('prepare.failedorgs', results.error.failed, tags);
                        process.exitCode = 1;
                        break;
                }
            }
        } catch (err) {
            if(err?.message){
                PrepareStreamService.buildPoolError(0,0,err.message,'failed');
            } else {
                PrepareStreamService.buildPoolError(0,0,JSON.stringify(err),'failed');
            }
            SFPLogger.log(COLOR_ERROR('Unable to execute command .. ' + err));
            process.exitCode = 1;
        } finally {
            PrepareStreamService.closeServer();
        }
    }

    private displayHeader(poolConfig: PoolConfig) {
        SFPLogger.log(COLOR_HEADER(`Pool Name: ${poolConfig.tag}`));
        SFPLogger.log(COLOR_HEADER(`Requested Count of Orgs: ${poolConfig.maxAllocation}`));
        SFPLogger.log(
            COLOR_HEADER(
                `Scratch Orgs to be submitted to pool in case of failures: ${
                    poolConfig.succeedOnDeploymentErrors ? 'true' : 'false'
                }`
            )
        );

        SFPLogger.log(
            COLOR_HEADER(`All packages in the repo to be installed: ${poolConfig.installAll ? 'true' : 'false'}`)
        );

        SFPLogger.log(
            COLOR_HEADER(
                `Enable Source Tracking: ${
                    poolConfig.enableSourceTracking || poolConfig.enableSourceTracking === undefined ? 'true' : 'false'
                }`
            )
        );

        if (poolConfig.enableVlocity) SFPLogger.log(COLOR_HEADER(`Enable Vlocity Config: true`));

        if (poolConfig.fetchArtifacts) {
            if (poolConfig.fetchArtifacts.artifactFetchScript)
                SFPLogger.log(
                    COLOR_HEADER(`Script provided to fetch artifacts: ${poolConfig.fetchArtifacts.artifactFetchScript}`)
                );
            if (poolConfig.fetchArtifacts.npm) {
                SFPLogger.log(COLOR_HEADER(`Fetch artifacts from pre-authenticated NPM registry: true`));
            }
        }

        SFPLogger.log(
            COLOR_HEADER(`-------------------------------------------------------------------------------------------`)
        );
    }

    private async getCurrentRemainingNumberOfOrgsInPoolAndReport(poolConfig: PoolConfig) {
        try {
            const results = await new ScratchOrgInfoFetcher(this.hubOrg).getScratchOrgsByTag(
                this.flags.tag,
                false,
                true
            );

            let tags = {
                stage: Stage.PREPARE,
                poolName: poolConfig.tag,
            };

            let availableSo = results.records.filter((soInfo) => soInfo.Allocation_status__c === 'Available');

            SFPStatsSender.logGauge('pool.available', availableSo.length, tags);
        } catch (error) {
            //do nothing, we are not reporting anything if anything goes wrong here
        }
    }

    public validatePoolConfig(poolConfig: any) {
        let ajv = new Ajv({ allErrors: true });
        let validator = ajv.compile(PoolSchema);
        let isSchemaValid = validator(poolConfig);
        if (!isSchemaValid) {
            let errorMsg: string = `The pool configuration is invalid, Please fix the following errors\n`;

            validator.errors.forEach((error, errorNum) => {
                errorMsg += `\n${errorNum + 1}: ${error.instancePath}: ${error.message} ${JSON.stringify(
                    error.params,
                    null,
                    4
                )}`;
            });
            PrepareStreamService.buildPoolError(0,0,errorMsg,'schema-validator')
            throw new Error(errorMsg);
        }
    }
}
