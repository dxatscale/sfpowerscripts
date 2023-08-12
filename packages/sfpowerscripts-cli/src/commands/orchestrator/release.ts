import { flags } from '@salesforce/command';
import SfpowerscriptsCommand from '../../SfpowerscriptsCommand';
import { Messages } from '@salesforce/core';
import SFPStatsSender from '@dxatscale/sfpowerscripts.core/lib/stats/SFPStatsSender';
import ReleaseImpl, { ReleaseProps, ReleaseResult } from '../../impl/release/ReleaseImpl';
import ReleaseDefinition from '../../impl/release/ReleaseDefinition';
import ReleaseError from '../../errors/ReleaseError';
import path = require('path');
import SFPLogger, {
    COLOR_ERROR,
    COLOR_HEADER,
    COLOR_TIME,
    COLOR_SUCCESS,
    COLOR_WARNING,
    COLOR_KEY_MESSAGE,
    ConsoleLogger,
} from '@dxatscale/sfp-logger';
import ReleaseDefinitionSchema from '../../impl/release/ReleaseDefinitionSchema';
import { ReleaseStreamService } from '@dxatscale/sfpowerscripts.core/lib/eventStream/release';

Messages.importMessagesDirectory(__dirname);
const messages = Messages.loadMessages('@dxatscale/sfpowerscripts', 'release');

export default class Release extends SfpowerscriptsCommand {
    public static description = messages.getMessage('commandDescription');

    public static examples = [
        `sfpowerscripts orchestrator:release -p path/to/releasedefinition.yml -u myorg --npm --scope myscope --generatechangelog`,
    ];

    protected static requiresUsername = false;
    protected static requiresDevhubUsername = false;
    protected static requiresProject = false;

    protected static flagsConfig = {
        releasedefinition: flags.array({
            char: 'p',
            description: messages.getMessage('releaseDefinitionFlagDescription'),
        }),
        targetorg: flags.string({
            char: 'u',
            description: messages.getMessage('targetOrgFlagDescription'),
            default: 'scratchorg',
            required: true,
        }),
        scriptpath: flags.filepath({
            char: 'f',
            description: messages.getMessage('scriptPathFlagDescription'),
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
        npmrcpath: flags.filepath({
            description: messages.getMessage('npmrcPathFlagDescription'),
            dependsOn: ['npm'],
            required: false,
        }),
        logsgroupsymbol: flags.array({
            char: 'g',
            description: messages.getMessage('logsGroupSymbolFlagDescription'),
        }),
        tag: flags.string({
            char: 't',
            description: messages.getMessage('tagFlagDescription'),
        }),
        dryrun: flags.boolean({
            description: messages.getMessage('dryRunFlagDescription'),
            default: false,
            hidden: true,
        }),
        waittime: flags.number({
            description: messages.getMessage('waitTimeFlagDescription'),
            default: 120,
        }),
        keys: flags.string({
            required: false,
            description: messages.getMessage('keysFlagDescription'),
        }),
        generatechangelog: flags.boolean({
            default: false,
            description: messages.getMessage('generateChangelogFlagDescription'),
        }),
        directory: flags.string({
            char: 'd',
            description: messages.getMessage('directoryFlagDescription'),
        }),
        branchname: flags.string({
            dependsOn: ['generatechangelog'],
            char: 'b',
            description: messages.getMessage('branchNameFlagDescription'),
        }),
        allowunpromotedpackages: flags.boolean({
            description: messages.getMessage('allowUnpromotedPackagesFlagDescription'),
            hidden: true,
            deprecated: {
                message: '--allowunpromotedpackages is deprecated, All packages are allowed',
                messageOverride: '--allowunpromotedpackages is deprecated, All packages are allowed',
            },
        }),
        devhubalias: flags.string({
            char: 'v',
            description: messages.getMessage('devhubAliasFlagDescription'),
        }),
        jobid: flags.string({
            char: 'j',
            description: messages.getMessage('jobIdFlagDescription'),
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
        this.validateFlags();
        ReleaseStreamService.startServer();

        let tags = {
            targetOrg: this.flags.targetorg,
        };

        if (this.flags.tag != null) {
            tags['tag'] = this.flags.tag;
        }

        let executionStartTime = Date.now();

        SFPLogger.log(COLOR_HEADER(`command: ${COLOR_KEY_MESSAGE(`release`)}`));
        SFPLogger.log(COLOR_HEADER(`Target Org: ${this.flags.targetorg}`));
        SFPLogger.log(COLOR_HEADER(`Release Definitions: ${this.flags.releasedefinition}`));
        SFPLogger.log(COLOR_HEADER(`Artifact Directory: ${path.resolve('artifacts')}`));

        SFPLogger.log(
            COLOR_HEADER(`-------------------------------------------------------------------------------------------`)
        );

        let releaseDefinitions: ReleaseDefinitionSchema[] = [];
        for (const pathToReleaseDefintion of this.flags.releasedefinition) {
            let releaseDefinition = (await ReleaseDefinition.loadReleaseDefinition(pathToReleaseDefintion))
                .releaseDefinition;

            //Support Legacy by taking the existing single workItemFilter and pushing it to the new model
            if (releaseDefinition.changelog?.workItemFilter) {
                releaseDefinition.changelog.workItemFilters = new Array<string>();
                releaseDefinition.changelog.workItemFilters.push(releaseDefinition.changelog?.workItemFilter);
            }

            if (this.flags.isGenerateChangelog && !releaseDefinition.changelog)
                throw new Error('changelog parameters must be specified in release definition to generate changelog');

            if (
                releaseDefinition.promotePackagesBeforeDeploymentToOrg &&
                this.flags.targetorg == releaseDefinition.promotePackagesBeforeDeploymentToOrg &&
                !this.flags.devhubalias
            )
                throw new Error('DevHub is mandatory when promote is used within release defintion');

            releaseDefinitions.push(releaseDefinition);
        }

        let releaseResult: ReleaseResult;
        try {
            let props: ReleaseProps = {
                releaseDefinitions: releaseDefinitions,
                targetOrg: this.flags.targetorg,
                fetchArtifactScript: this.flags.scriptpath,
                isNpm: this.flags.npm,
                scope: this.flags.scope,
                npmrcPath: this.flags.npmrcpath,
                logsGroupSymbol: this.flags.logsgroupsymbol,
                tags: tags,
                isDryRun: this.flags.dryrun,
                waitTime: this.flags.waittime,
                keys: this.flags.keys,
                isGenerateChangelog: this.flags.generatechangelog,
                devhubUserName: this.flags.devhubalias,
                branch: this.flags.branchname,
                directory: this.flags.directory,
            };

            ReleaseStreamService.buildProps(props);
            ReleaseStreamService.buildJobId(this.flags.jobid ?? Date.now().toString());

            let releaseImpl: ReleaseImpl = new ReleaseImpl(props, new ConsoleLogger());

            releaseResult = await releaseImpl.exec();

            SFPStatsSender.logCount('release.succeeded', tags);
        } catch (err) {
            if (err instanceof ReleaseError) {
                releaseResult = err.data;
                ReleaseStreamService.buildCommandError(err.message);
            } else {
                SFPLogger.log(err.message);
                ReleaseStreamService.buildCommandError(err.message);
                SFPStatsSender.logCount('release.failed', tags);

                // Fail the task when an error occurs
                process.exitCode = 1;
            }
        } finally {
            let totalElapsedTime: number = Date.now() - executionStartTime;

            if (releaseResult) {
                this.printReleaseSummary(releaseResult, totalElapsedTime);
                this.sendMetrics(releaseResult, tags, totalElapsedTime);
            }
            ReleaseStreamService.closeServer();
        }
    }

    private sendMetrics(releaseResult: ReleaseResult, tags: any, totalElapsedTime: number) {
        SFPStatsSender.logCount('release.scheduled', tags);

        SFPStatsSender.logGauge('release.duration', totalElapsedTime, tags);

        let packagesScheduled = 0;
        let packagesSucceeded = 0;
        let packagesFailed = 0;

        for (const deploymentResults of releaseResult.succeededDeployments) {
            packagesScheduled += deploymentResults.result.scheduled;
            packagesSucceeded += deploymentResults.result.deployed.length;
        }

        for (const deploymentResults of releaseResult.failedDeployments) {
            packagesScheduled += deploymentResults.result.scheduled;
            packagesSucceeded += deploymentResults.result.deployed.length;
            packagesFailed += deploymentResults.result.failed.length;
        }

        ReleaseStreamService.buildStatistik(totalElapsedTime, packagesFailed, packagesSucceeded, packagesScheduled);

        SFPStatsSender.logGauge('release.packages.scheduled', packagesScheduled, tags);
        SFPStatsSender.logGauge('release.packages.succeeded', packagesSucceeded, tags);
        SFPStatsSender.logGauge('release.packages.failed', packagesFailed, tags);
    }

    private printReleaseSummary(releaseResult: ReleaseResult, totalElapsedTime: number): void {
        if (this.flags.logsgroupsymbol?.[0])
            SFPLogger.log(COLOR_HEADER(this.flags.logsgroupsymbol[0], 'Release Summary'));

        SFPLogger.log(
            COLOR_HEADER(
                `----------------------------------------------------------------------------------------------------`
            )
        );
        if (releaseResult.installDependenciesResult) {
            SFPLogger.log(COLOR_HEADER(`\nPackage Dependencies`));
            SFPLogger.log(COLOR_SUCCESS(`   ${releaseResult.installDependenciesResult.success.length} succeeded`));
            SFPLogger.log(COLOR_WARNING(`   ${releaseResult.installDependenciesResult.skipped.length} skipped`));
            SFPLogger.log(COLOR_ERROR(`   ${releaseResult.installDependenciesResult.failed.length} failed`));
        }

        for (const succeededDeployment of releaseResult.succeededDeployments) {
            SFPLogger.log(COLOR_HEADER(`\n Release Defintion: ${succeededDeployment.releaseDefinition.release}`));
            SFPLogger.log(COLOR_SUCCESS(`   ${succeededDeployment.result.deployed.length} succeeded`));
            SFPLogger.log(COLOR_ERROR(`   ${succeededDeployment.result.failed.length} failed`));
        }

        for (const failedDeployment of releaseResult.failedDeployments) {
            SFPLogger.log(COLOR_HEADER(`\n Release Defintion: ${failedDeployment.releaseDefinition.release}`));
            SFPLogger.log(COLOR_SUCCESS(`   ${failedDeployment.result.deployed.length} succeeded`));
            SFPLogger.log(
                COLOR_ERROR(
                    `\nPackages Failed to Deploy`,
                    failedDeployment.result.failed.map((packageInfo) => packageInfo.sfpPackage.packageName)
                )
            );
        }

        SFPLogger.log(COLOR_TIME(`\nElapsed Time: ${new Date(totalElapsedTime).toISOString().substr(11, 8)}`));
        SFPLogger.log(
            COLOR_HEADER(
                `----------------------------------------------------------------------------------------------------`
            )
        );
    }

    protected validateFlags() {
        if (this.flags.npm && !this.flags.scope) throw new Error('--scope parameter is required for NPM');
    }
}
