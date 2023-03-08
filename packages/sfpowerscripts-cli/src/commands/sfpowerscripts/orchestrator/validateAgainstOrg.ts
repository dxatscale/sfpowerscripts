import { Messages, Org } from '@salesforce/core';
import SfpowerscriptsCommand from '../../../SfpowerscriptsCommand';
import { flags } from '@salesforce/command';
import ValidateImpl, { ValidateAgainst, ValidateProps, ValidationMode } from '../../../impl/validate/ValidateImpl';
import SFPStatsSender from '@dxatscale/sfpowerscripts.core/lib/stats/SFPStatsSender';
import SFPLogger, { COLOR_HEADER, COLOR_KEY_MESSAGE } from '@dxatscale/sfp-logger';
import * as fs from 'fs-extra';


Messages.importMessagesDirectory(__dirname);
const messages = Messages.loadMessages('@dxatscale/sfpowerscripts', 'validateAgainstOrg');

export default class Validate extends SfpowerscriptsCommand {
    public static description = messages.getMessage('commandDescription');

    public static examples = [`$ sfdx sfpowerscripts:orchestrator:validateAgainstOrg -u <targetorg>`];

    protected static flagsConfig = {
        targetorg: flags.string({
            char: 'u',
            description: messages.getMessage('targetOrgFlagDescription'),
            required: true,
        }),
        mode: flags.enum({
            description: 'validation mode',
            default: 'thorough',
            required: true,
            options: ['individual', 'fastfeedback', 'thorough', 'ff-release-config', 'thorough-release-config'],
        }),
        releaseconfig: flags.string({
            description: messages.getMessage('configFileFlagDescription'),
        }),
        coveragepercent: flags.integer({
            description: messages.getMessage('coveragePercentFlagDescription'),
            default: 75,
        }),
        diffcheck: flags.boolean({
            description: messages.getMessage('diffCheckFlagDescription'),
            default: false,
        }),
        disableartifactupdate: flags.boolean({
            description: messages.getMessage('disableArtifactUpdateFlagDescription'),
            default: false,
        }),
        logsgroupsymbol: flags.array({
            char: 'g',
            description: messages.getMessage('logsGroupSymbolFlagDescription'),
        }),
        basebranch: flags.string({
            description: messages.getMessage('baseBranchFlagDescription'),
        }),
        devhubalias: flags.string({
            char: 'v',
            description: messages.getMessage('devhubAliasFlagDescription')
        }),
        disablesourcepkgoverride: flags.boolean({
            description: messages.getMessage('disableSourcePackageOverride'),
            dependsOn:['devhubalias']
        }),
        disableparalleltesting: flags.boolean({
            description: messages.getMessage('disableParallelTestingFlagDescription'),
            default: false,
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

        SFPLogger.log(COLOR_HEADER(`command: ${COLOR_KEY_MESSAGE(`validateAgainstOrg`)}`));
        SFPLogger.log(COLOR_HEADER(`Target Org: ${this.flags.targetorg}`));
        SFPLogger.log(
            COLOR_HEADER(
                `Validation Mode: ${COLOR_KEY_MESSAGE(
                    `${
                        ValidationMode[
                            Object.keys(ValidationMode)[
                                (Object.values(ValidationMode) as string[]).indexOf(this.flags.mode)
                            ]
                        ]
                    }`
                )}`
            )
        );
        if (this.flags.mode != ValidationMode.FAST_FEEDBACK) {
            SFPLogger.log(COLOR_HEADER(`Coverage Percentage: ${this.flags.coveragepercent}`));
        }
      

        SFPLogger.log(
            COLOR_HEADER(`-------------------------------------------------------------------------------------------`)
        );


        let validateResult: boolean = false;
        try {
            let validateProps: ValidateProps = {
                validateAgainst: ValidateAgainst.PROVIDED_ORG,
                validationMode:  ValidationMode[
                    Object.keys(ValidationMode)[
                        (Object.values(ValidationMode) as string[]).indexOf(this.flags.mode)
                    ]
                ],
                coverageThreshold: this.flags.coveragepercent,
                logsGroupSymbol: this.flags.logsgroupsymbol,
                targetOrg: this.flags.targetorg,
                diffcheck: this.flags.diffcheck,
                baseBranch: this.flags.basebranch,
                disableArtifactCommit: this.flags.disableartifactupdate,
                disableSourcePackageOverride: this.flags.disablesourcepkgoverride,
                disableParallelTestExecution: this.flags.disableparalleltesting
            };


            //Add check for devhub
            if(this.flags.devhubalias)
            {
                validateProps.hubOrg = await Org.create({aliasOrUsername:this.flags.devhubalias});
            }

            setReleaseConfigForReleaseBasedModes(this.flags.releaseconfig,validateProps);
            let validateImpl: ValidateImpl = new ValidateImpl(validateProps);
            await validateImpl.exec();
        } catch (error) {
            console.log(error.message);
            process.exitCode = 1;
        } finally {
            let totalElapsedTime: number = Date.now() - executionStartTime;

            SFPStatsSender.logGauge('validate.duration', totalElapsedTime);

            if (validateResult) SFPStatsSender.logCount('validate.succeeded');
            else SFPStatsSender.logCount('validate.failed');
        }

        function setReleaseConfigForReleaseBasedModes(releaseconfigPath:string,validateProps: ValidateProps) {
            if (validateProps.validationMode == ValidationMode.FASTFEEDBACK_LIMITED_BY_RELEASE_CONFIG ||
                validateProps.validationMode == ValidationMode.THOROUGH_LIMITED_BY_RELEASE_CONFIG) {
                if (releaseconfigPath && fs.existsSync(releaseconfigPath)) {
                    validateProps.releaseConfigPath = releaseconfigPath;
                }

                else {
                    if (!releaseconfigPath)
                        throw new Error(`Release config is required when using validation by release config`);
                    else if (!fs.existsSync(releaseconfigPath))
                        throw new Error(`Release config at ${releaseconfigPath} doesnt exist, Please check the path`);
                }
            }
        }
    }
}
