import SfpowerscriptsCommand from '../../SfpowerscriptsCommand';
import { LoggerLevel, Messages } from '@salesforce/core';
import FetchImpl, { ArtifactVersion } from '../../impl/artifacts/FetchImpl';
import ReleaseDefinition from '../../impl/release/ReleaseDefinition';
import FetchArtifactsError from '../../impl/artifacts/FetchArtifactsError';
import { ConsoleLogger } from '@dxatscale/sfp-logger';
import { Flags } from '@oclif/core';
import { loglevel } from '../../flags/sfdxflags';
import SFPLogger from '@dxatscale/sfp-logger';
import { COLOR_HEADER } from '@dxatscale/sfp-logger';

Messages.importMessagesDirectory(__dirname);
const messages = Messages.loadMessages('@dxatscale/sfpowerscripts', 'fetch');

export default class Fetch extends SfpowerscriptsCommand {
    public static description = messages.getMessage('commandDescription');

    public static examples = [
        `$ sfp artifacts:fetch -p myreleasedefinition.yaml -f myscript.sh`,
        `$ sfp artifacts:fetch -p myreleasedefinition.yaml --npm --scope myscope --npmrcpath path/to/.npmrc`,
    ];

    protected static requiresUsername = false;
    protected static requiresDevhubUsername = false;

    public static flags = {
        releasedefinition: Flags.file({
            char: 'p',
            description: messages.getMessage('releaseDefinitionFlagDescription'),
        }),
        artifactdir: Flags.directory({
            required: true,
            char: 'd',
            description: messages.getMessage('artifactDirectoryFlagDescription'),
            default: 'artifacts',
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
            parse: async (scope) => scope.replace(/@/g, '').toLowerCase()
        }),
        npmrcpath: Flags.file({
            description: messages.getMessage('npmrcPathFlagDescription'),
            dependsOn: ['npm'],
            required: false,
        }),
        loglevel
    };

    public async execute() {
        this.validateFlags();

        let releaseDefinition = (await ReleaseDefinition.loadReleaseDefinition(this.flags.releasedefinition)).releaseDefinition;
        let result: {
            success: ArtifactVersion[];
            failed:  ArtifactVersion[];
        };

        let executionStartTime = Date.now();
        try {
            let fetchImpl: FetchImpl = new FetchImpl(
                this.flags.artifactdir,
                this.flags.scriptpath,
                this.flags.scope,
                this.flags.npmrcpath,
                new ConsoleLogger()
            );

            result = await fetchImpl.fetchArtifacts([releaseDefinition]);
        } catch (err) {
            if (err instanceof FetchArtifactsError) {
                result = err.data;
            } else {
                console.log(err.message);
            }

            process.exitCode = 1;
        } finally {
            let totalElapsedTime: number = Date.now() - executionStartTime;

            if (result) this.printSummary(result, totalElapsedTime);
        }
    }

    private printSummary(
        result: { success: ArtifactVersion[]; failed:ArtifactVersion[] },
        totalElapsedTime: number
    ) {
        SFPLogger.printHeaderLine('',COLOR_HEADER,LoggerLevel.INFO);
        SFPLogger.log(`Fetched ${result.success.length} artifacts`);

        if (result.failed.length > 0) console.log(`Failed to fetch ${result.failed.length} artifacts`);

        SFPLogger.log(`Elapsed Time: ${new Date(totalElapsedTime).toISOString().substr(11, 8)}`);
        SFPLogger.printHeaderLine('',COLOR_HEADER,LoggerLevel.INFO);
    }

    protected validateFlags() {
        if (this.flags.npm && !this.flags.scope) throw new Error('--scope parameter is required for NPM');
    }
}
