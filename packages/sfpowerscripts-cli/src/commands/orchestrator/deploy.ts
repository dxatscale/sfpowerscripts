import { flags } from '@salesforce/command';
import SfpowerscriptsCommand from '../../SfpowerscriptsCommand';
import { Messages } from '@salesforce/core';
import SFPStatsSender from '@dxatscale/sfpowerscripts.core/lib/stats/SFPStatsSender';
import DeployImpl, { DeploymentMode, DeployProps, DeploymentResult } from '../../impl/deploy/DeployImpl';
import { Stage } from '../../impl/Stage';
import SFPLogger, {
    COLOR_ERROR,
    COLOR_HEADER,
    COLOR_KEY_MESSAGE,
    COLOR_SUCCESS,
} from '@dxatscale/sfp-logger';
import { COLOR_TIME } from '@dxatscale/sfp-logger';
import getFormattedTime from '@dxatscale/sfpowerscripts.core/lib/utils/GetFormattedTime';

// Initialize Messages with the current plugin directory
Messages.importMessagesDirectory(__dirname);

// Load the specific messages for this file. Messages from @salesforce/command, @salesforce/core,
// or any library that is using the messages framework can also be loaded this way.
const messages = Messages.loadMessages('@dxatscale/sfpowerscripts', 'deploy');

export default class Deploy extends SfpowerscriptsCommand {
    public static description = messages.getMessage('commandDescription');

    public static examples = [`$ sfpowerscripts orchestrator:deploy -u <username>`];

    protected static requiresUsername = false;
    protected static requiresDevhubUsername = false;
    protected static requiresProject = false;

    protected static flagsConfig = {
        targetorg: flags.string({
            char: 'u',
            description: messages.getMessage('targetOrgFlagDescription'),
            default: 'scratchorg',
            required: true,
        }),
        artifactdir: flags.directory({
            description: messages.getMessage('artifactDirectoryFlagDescription'),
            default: 'artifacts',
        }),
        waittime: flags.number({
            description: messages.getMessage('waitTimeFlagDescription'),
            default: 120,
        }),
        tag: flags.string({
            char: 't',
            description: messages.getMessage('tagFlagDescription'),
        }),
        skipifalreadyinstalled: flags.boolean({
            required: false,
            default: false,
            description: messages.getMessage('skipIfAlreadyInstalled'),
        }),
        baselineorg: flags.string({
            char: 'b',
            description: messages.getMessage('baselineorgFlagDescription'),
            required: false,
            dependsOn: ['skipifalreadyinstalled'],
        }),
        allowunpromotedpackages: flags.boolean({
            description: messages.getMessage('allowUnpromotedPackagesFlagDescription'),
            deprecated: { 
                message: '--allowunpromotedpackages is deprecated, All packages are allowed',
                messageOverride: '--allowunpromotedpackages is deprecated, All packages are allowed' },
            hidden: true,
        }),
        retryonfailure: flags.boolean({
            description: messages.getMessage('retryOnFailureFlagDescription'),
            hidden: true,
        }),
        logsgroupsymbol: flags.array({
            char: 'g',
            description: messages.getMessage('logsGroupSymbolFlagDescription'),
        }),
        releaseconfig: flags.string({
            description: messages.getMessage('configFileFlagDescription'),
        }),
        enablesourcetracking: flags.boolean({
            description: messages.getMessage('enableSourceTrackingFlagDescription'),
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
        let executionStartTime = Date.now();

        SFPLogger.log(COLOR_HEADER(`command: ${COLOR_KEY_MESSAGE(`deploy`)}`));
        SFPLogger.log(COLOR_HEADER(`Skip Packages If Already Installed: ${this.flags.skipifalreadyinstalled}`));
        SFPLogger.log(COLOR_HEADER(`Artifact Directory: ${this.flags.artifactdir}`));
        SFPLogger.log(COLOR_HEADER(`Target Environment: ${this.flags.targetorg}`));
        if(this.flags.releaseconfig) SFPLogger.log(COLOR_HEADER(`Filter according to: ${this.flags.releaseconfig}`));
        if (this.flags.baselineorg) SFPLogger.log(COLOR_HEADER(`Baselined Against Org: ${this.flags.baselineorg}`));
        SFPLogger.log(
            COLOR_HEADER(`-------------------------------------------------------------------------------------------`)
        );

        let deploymentResult: DeploymentResult;

        let tags = {
            targetOrg: this.flags.targetorg,
        };

        if (this.flags.tag != null) {
            tags['tag'] = this.flags.tag;
        }

        let deployProps: DeployProps = {
            targetUsername: this.flags.targetorg,
            artifactDir: this.flags.artifactdir,
            waitTime: this.flags.waittime,
            tags: tags,
            isTestsToBeTriggered: false,
            deploymentMode: this.flags.enablesourcetracking? DeploymentMode.SOURCEPACKAGES_PUSH: DeploymentMode.NORMAL,
            skipIfPackageInstalled: this.flags.skipifalreadyinstalled,
            logsGroupSymbol: this.flags.logsgroupsymbol,
            currentStage: Stage.DEPLOY,
            baselineOrg: this.flags.baselineorg,
            isRetryOnFailure: this.flags.retryonfailure,
            releaseConfigPath: this.flags.releaseconfig,
        };

        try {
            let deployImpl: DeployImpl = new DeployImpl(deployProps);

            deploymentResult = await deployImpl.exec();

            if (deploymentResult.failed.length > 0 || deploymentResult.error) {
                process.exitCode = 1;
            }
        } catch (error) {
            SFPLogger.log(COLOR_ERROR(error));
            process.exitCode = 1;
        } finally {
            let totalElapsedTime: number = Date.now() - executionStartTime;

        
            SFPLogger.log(
                COLOR_HEADER(
                    `----------------------------------------------------------------------------------------------------`
                )
            );
            SFPLogger.log(
                COLOR_SUCCESS(
                    `${deploymentResult.deployed.length} packages deployed in ${COLOR_TIME(
                        getFormattedTime(totalElapsedTime)
                    )} with {${deploymentResult.failed.length}} errors`
                )
            );

            if (deploymentResult.failed.length > 0) {
                SFPLogger.log(
                    COLOR_ERROR(
                        `\nPackages Failed to Deploy`,
                        deploymentResult.failed.map((packageInfo) => packageInfo.sfpPackage.packageName)
                    )
                );
            }
            SFPLogger.log(
                COLOR_HEADER(
                    `----------------------------------------------------------------------------------------------------`
                )
            );

          
            SFPStatsSender.logCount('deploy.scheduled', tags);

            SFPStatsSender.logGauge('deploy.packages.scheduled', deploymentResult.scheduled, tags);

            SFPStatsSender.logGauge('deploy.duration', totalElapsedTime, tags);

            SFPStatsSender.logGauge('deploy.succeeded.packages', deploymentResult.deployed.length, tags);

            SFPStatsSender.logGauge('deploy.failed.packages', deploymentResult.failed.length, tags);

            if (deploymentResult.failed.length > 0) {
                SFPStatsSender.logCount('deploy.failed', tags);
            } else {
                SFPStatsSender.logCount('deploy.succeeded', tags);
            }
        }
    }
}
