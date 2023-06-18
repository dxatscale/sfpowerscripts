import { flags } from '@salesforce/command';
import SfpowerscriptsCommand from '../../SfpowerscriptsCommand';
import { Messages } from '@salesforce/core';
import FetchImpl, { ArtifactVersion } from '../../impl/artifacts/FetchImpl';
import ReleaseDefinition from '../../impl/release/ReleaseDefinition';
import FetchArtifactsError from '../../impl/artifacts/FetchArtifactsError';
import { ConsoleLogger } from '@dxatscale/sfp-logger';

Messages.importMessagesDirectory(__dirname);
const messages = Messages.loadMessages('@dxatscale/sfpowerscripts', 'fetch');

export default class Fetch extends SfpowerscriptsCommand {
    public static description = messages.getMessage('commandDescription');

    public static examples = [
        `$ sfpowerscripts artifacts:fetch -p myreleasedefinition.yaml -f myscript.sh`,
        `$ sfpowerscripts artifacts:fetch -p myreleasedefinition.yaml --npm --scope myscope --npmrcpath path/to/.npmrc`,
    ];

    protected static requiresUsername = false;
    protected static requiresDevhubUsername = false;

    protected static flagsConfig = {
        releasedefinition: flags.filepath({
            char: 'p',
            description: messages.getMessage('releaseDefinitionFlagDescription'),
        }),
        artifactdir: flags.directory({
            required: true,
            char: 'd',
            description: messages.getMessage('artifactDirectoryFlagDescription'),
            default: 'artifacts',
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
            parse: async (scope) => scope.replace(/@/g, '').toLowerCase()
        }),
        npmrcpath: flags.filepath({
            description: messages.getMessage('npmrcPathFlagDescription'),
            dependsOn: ['npm'],
            required: false,
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
        console.log(
            `----------------------------------------------------------------------------------------------------`
        );
        console.log(`Fetched ${result.success.length} artifacts`);

        if (result.failed.length > 0) console.log(`Failed to fetch ${result.failed.length} artifacts`);

        console.log(`Elapsed Time: ${new Date(totalElapsedTime).toISOString().substr(11, 8)}`);
        console.log(
            `----------------------------------------------------------------------------------------------------`
        );
    }

    protected validateFlags() {
        if (this.flags.npm && !this.flags.scope) throw new Error('--scope parameter is required for NPM');
    }
}
