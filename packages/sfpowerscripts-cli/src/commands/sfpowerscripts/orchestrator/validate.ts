import { Messages } from '@salesforce/core';
import SfpowerscriptsCommand from '../../../SfpowerscriptsCommand';
import { flags } from '@salesforce/command';
import ValidateImpl, { ValidateMode, ValidateProps } from '../../../impl/validate/ValidateImpl';
import SFPStatsSender from '@dxatscale/sfpowerscripts.core/lib/stats/SFPStatsSender';
import SFPLogger, { COLOR_HEADER, COLOR_KEY_MESSAGE } from '@dxatscale/sfpowerscripts.core/lib/logger/SFPLogger';
import ValidateError from '../../../errors/ValidateError';
import ValidateResult from '../../../impl/validate/ValidateResult';


Messages.importMessagesDirectory(__dirname);
const messages = Messages.loadMessages('@dxatscale/sfpowerscripts', 'validate');

export default class Validate extends SfpowerscriptsCommand {
    protected static requiresProject = true;

    public static description = messages.getMessage('commandDescription');

    protected static requiresDevhubUsername = true;

    public static examples = [
        `$ sfdx sfpowerscripts:orchestrator:validate -p "POOL_TAG_1,POOL_TAG_2" -v <devHubUsername>`,
    ];

    static aliases = ['sfpowerscripts:orchestrator:validateAgainstPool'];

    protected static flagsConfig = {
        devhubusername: flags.string({
            char: 'u',
            deprecated: { messageOverride: '--devhubusername is deprecated, utilize the default devhub flag' },
            description: messages.getMessage('devhubUsernameFlagDescription'),
            required: false,
            hidden: true,
        }),
        pools: flags.array({
            char: 'p',
            description: messages.getMessage('poolsFlagDescription'),
            required: true,
        }),
        jwtkeyfile: flags.filepath({
            deprecated: {
                messageOverride: '--jwtkeyfile is deprecated, Validate no longer accepts jwt based auth mechanism',
            },
            char: 'f',
            description: messages.getMessage('jwtKeyFileFlagDescription'),
            required: false,
            hidden: true,
        }),
        clientid: flags.string({
            deprecated: {
                messageOverride: '--clientid is deprecated, Validate no longer accepts jwt based auth mechanism',
            },
            char: 'i',
            description: messages.getMessage('clientIdFlagDescription'),
            required: false,
            hidden: true,
        }),
        shapefile: flags.string({
            description: messages.getMessage('shapeFileFlagDescription'),
        }),
        coveragepercent: flags.integer({
            description: messages.getMessage('coveragePercentFlagDescription'),
            default: 75,
        }),
        logsgroupsymbol: flags.array({
            char: 'g',
            description: messages.getMessage('logsGroupSymbolFlagDescription'),
        }),
        deletescratchorg: flags.boolean({
            char: 'x',
            description: messages.getMessage('deleteScratchOrgFlagDescription'),
            default: false,
        }),
        keys: flags.string({
            required: false,
            description: messages.getMessage('keysFlagDescription'),
        }),
        visualizechangesagainst: flags.string({
            char: 'c',
            description: messages.getMessage('visualizeChangesAgainstFlagDescription'),
            deprecated: {
                messageOverride: '--visualizechangesagainst is deprecated, use --basebranch instead',
            },
        }),
        basebranch: flags.string({
            description: messages.getMessage('baseBranchFlagDescription'),
        }),
        enableimpactanalysis: flags.boolean({
            description: messages.getMessage('enableImpactAnalysisFlagDescription'),
            dependsOn: ['basebranch'],
        }),
        enabledependencyvalidation: flags.boolean({
            description: messages.getMessage('enableDependencyValidation'),
            dependsOn: ['basebranch'],
        }),
        tag: flags.string({
            description: messages.getMessage('tagFlagDescription'),
        }),
        disablediffcheck: flags.boolean({
            description: messages.getMessage('disableDiffCheckFlagDescription'),
            default: false,
        }),
        disableartifactupdate: flags.boolean({
            description: messages.getMessage('disableArtifactUpdateFlagDescription'),
            default: false,
        }),
        fastfeedback: flags.boolean({
            hidden:true,
            description: messages.getMessage('fastfeedbackFlagDescription'),
            dependsOn: ['basebranch'],
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

    async execute(): Promise<void> {
        let executionStartTime = Date.now();

        await this.hubOrg.refreshAuth();

        let tags: { [p: string]: string };
        if (this.flags.tag != null) {
            tags = {
                tag: this.flags.tag,
            };
        }

        SFPLogger.log(COLOR_HEADER(`command: ${COLOR_KEY_MESSAGE(`validate`)}`));
        SFPLogger.log(COLOR_HEADER(`Pools being used: ${this.flags.pools}`));
        SFPLogger.log(COLOR_HEADER(`Coverage Percentage: ${this.flags.coveragepercent}`));
        SFPLogger.log(
            COLOR_HEADER(`Dependency Validation: ${this.flags.enabledependencyvalidation ? 'true' : 'false'}`)
        );
        SFPLogger.log(
            COLOR_HEADER(
                `Using shapefile to override existing shape of the org: ${this.flags.shapefile ? 'true' : 'false'}`
            )
        );

        SFPLogger.log(
            COLOR_HEADER(`-------------------------------------------------------------------------------------------`)
        );

        let validateResult: ValidateResult;
        try {

            
            let validateProps: ValidateProps = {
                validateMode: ValidateMode.POOL,
                coverageThreshold: this.flags.coveragepercent,
                logsGroupSymbol: this.flags.logsgroupsymbol,
                pools: this.flags.pools,
                hubOrg: this.hubOrg,
                shapeFile: this.flags.shapefile,
                isDeleteScratchOrg: this.flags.deletescratchorg,
                keys: this.flags.keys,
                baseBranch: this.flags.basebranch,
                isImpactAnalysis: this.flags.enableimpactanalysis,
                isDependencyAnalysis: this.flags.enabledependencyvalidation,
                diffcheck: !this.flags.disablediffcheck,
                disableArtifactCommit: this.flags.disableartifactupdate,
                isFastFeedbackMode:this.flags.fastfeedback
            };

           
              
            let validateImpl: ValidateImpl = new ValidateImpl(validateProps);

            validateResult = await validateImpl.exec();

            SFPStatsSender.logCount('validate.succeeded', tags);
        } catch (error) {
            if (error instanceof ValidateError) {
                validateResult = error.data;
            } else SFPLogger.log(error.message);

            SFPStatsSender.logCount('validate.failed', tags);

            process.exitCode = 1;
        } finally {
            let totalElapsedTime: number = Date.now() - executionStartTime;

            SFPStatsSender.logGauge('validate.duration', totalElapsedTime, tags);

            SFPStatsSender.logCount('validate.scheduled', tags);

            if (validateResult) {
                SFPStatsSender.logGauge(
                    'validate.packages.scheduled',
                    validateResult.deploymentResult?.scheduled,
                    tags
                );

                SFPStatsSender.logGauge(
                    'validate.packages.succeeded',
                    validateResult.deploymentResult?.deployed?.length,
                    tags
                );

                SFPStatsSender.logGauge(
                    'validate.packages.failed',
                    validateResult.deploymentResult?.failed?.length,
                    tags
                );
            }
        }
    }
}
