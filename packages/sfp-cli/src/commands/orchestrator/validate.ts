import { Messages } from '@salesforce/core';
import SfpCommand from '../../SfpCommand';
import ValidateImpl, { ValidateAgainst, ValidateProps, ValidationMode } from '../../impl/validate/ValidateImpl';
import SFPStatsSender from '../../core/stats/SFPStatsSender';
import SFPLogger, { COLOR_HEADER, COLOR_KEY_MESSAGE } from '@flxblio/sfp-logger';
import ValidateError from '../../errors/ValidateError';
import ValidateResult from '../../impl/validate/ValidateResult';
import * as fs from 'fs-extra';
import { arrayFlagSfdxStyle, loglevel, logsgroupsymbol, targetdevhubusername } from '../../flags/sfdxflags';
import { Flags } from '@oclif/core';
import { LoggerLevel } from '@flxblio/sfp-logger';

Messages.importMessagesDirectory(__dirname);
const messages = Messages.loadMessages('@flxblio/sfp', 'validate');

export default class Validate extends SfpCommand {
    protected static requiresProject = true;

    public static description = messages.getMessage('commandDescription');

    protected static requiresDevhubUsername = true;

    public static examples = [
        `$ sfp orchestrator:validate -p "POOL_TAG_1,POOL_TAG_2" -v <devHubUsername>`,
    ];

   //Fix Typo
    public static flags = {
        pools: arrayFlagSfdxStyle({
            char: 'p',
            description: messages.getMessage('poolsFlagDescription'),
            required: true,
        }),
        targetdevhubusername,
        mode: Flags.string({
            description: 'validation mode',
            default: 'thorough',
            required: true,
            options: ['individual', 'fastfeedback', 'thorough', 'ff-release-config', 'thorough-release-config'],
        }),
        installdeps: Flags.boolean({
            description: messages.getMessage('installDepsFlagDescription'),
            default: false,
        }),
        releaseconfig: Flags.string({
            description: messages.getMessage('configFileFlagDescription'),
        }),
        coveragepercent: Flags.integer({
            description: messages.getMessage('coveragePercentFlagDescription'),
            default: 75,
        }),
        disablesourcepkgoverride: Flags.boolean({
            description: messages.getMessage('disableSourcePackageOverride'),
            default: false,
        }),
        deletescratchorg: Flags.boolean({
            char: 'x',
            description: messages.getMessage('deleteScratchOrgFlagDescription'),
            default: false,
        }),
        orginfo: Flags.boolean({
            description: messages.getMessage('orgInfoFlagDescription'),
            default: false,
        }),
        keys: Flags.string({
            required: false,
            description: messages.getMessage('keysFlagDescription'),
        }),
        basebranch: Flags.string({
            description: messages.getMessage('baseBranchFlagDescription'),
        }),
        enableimpactanalysis: Flags.boolean({
            description: messages.getMessage('enableImpactAnalysisFlagDescription'),
            dependsOn: ['basebranch'],
        }),
        enabledependencyvalidation: Flags.boolean({
            description: messages.getMessage('enableDependencyValidation'),
            dependsOn: ['basebranch'],
        }),
        tag: Flags.string({
            description: messages.getMessage('tagFlagDescription'),
        }),
        disableparalleltesting: Flags.boolean({
            description: messages.getMessage('disableParallelTestingFlagDescription'),
            default: false,
        }),
        disablediffcheck: Flags.boolean({
            description: messages.getMessage('disableDiffCheckFlagDescription'),
            default: false,
        }),
        disableartifactupdate: Flags.boolean({
            description: messages.getMessage('disableArtifactUpdateFlagDescription'),
            default: false,
        }),
        logsgroupsymbol,
        loglevel
    };

    async execute(): Promise<void> {
        let executionStartTime = Date.now();

        await this.hubOrg.refreshAuth();

        let tags: { [p: string]: string };
        tags = {
            tag: this.flags.tag != null ? this.flags.tag : undefined,
            validation_mode: this.flags.mode,
            releaseConfig: this.flags.releaseconfig,
        };

        SFPLogger.log(COLOR_HEADER(`command: ${COLOR_KEY_MESSAGE(`validate`)}`));
        SFPLogger.log(COLOR_HEADER(`Pools being used: ${this.flags.pools}`));
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
            COLOR_HEADER(`Dependency Validation: ${this.flags.enabledependencyvalidation ? 'true' : 'false'}`)
        );
       

        SFPLogger.printHeaderLine('',COLOR_HEADER,LoggerLevel.INFO);

        let validateResult: ValidateResult;
        try {
            let validateProps: ValidateProps = {
                validateAgainst: ValidateAgainst.PRECREATED_POOL,
                validationMode:
                    ValidationMode[
                        Object.keys(ValidationMode)[
                            (Object.values(ValidationMode) as string[]).indexOf(this.flags.mode)
                        ]
                    ],
                coverageThreshold: this.flags.coveragepercent,
                logsGroupSymbol: this.flags.logsgroupsymbol,
                pools: this.flags.pools,
                hubOrg: this.hubOrg,
                shapeFile: this.flags.shapefile,
                isDeleteScratchOrg: this.flags.deletescratchorg,
                keys: this.flags.keys,
                baseBranch: this.flags.basebranch,
                diffcheck: !this.flags.disablediffcheck,
                disableArtifactCommit: this.flags.disableartifactupdate,
                orgInfo: this.flags.orginfo,
                disableSourcePackageOverride : this.flags.disablesourcepkgoverride,
                disableParallelTestExecution: this.flags.disableparalleltesting,
                installExternalDependencies: this.flags.installdeps,
            };

            setReleaseConfigForReleaseBasedModes(this.flags.releaseconfig,validateProps);

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