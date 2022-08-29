import { ConsoleLogger } from '@dxatscale/sfp-logger';
import SFPOrg from '@dxatscale/sfpowerscripts.core/lib/org/SFPOrg';
import { flags } from '@salesforce/command';
import { Messages } from '@salesforce/core';
import ReleaseDefinitionGenerator from '../../../impl/release/ReleaseDefinitionGenerator';
import SfpowerscriptsCommand from '../../../SfpowerscriptsCommand';

Messages.importMessagesDirectory(__dirname);
const messages = Messages.loadMessages('@dxatscale/sfpowerscripts', 'releasedefinition_generate');

export default class Generate extends SfpowerscriptsCommand {
    public static description = messages.getMessage('commandDescription');

    public static examples = [
        `$ sfdx sfpowerscripts:releasedefinition:generate -n <releaseName>`,
    ];

    protected static requiresProject = true;
    protected static requiresDevhubUsername = false;

    protected static flagsConfig = {
        gitref: flags.string({
            char: 'c',
            description: messages.getMessage('commitFlagDescription'),
            required:true
        }),
        configfile: flags.string({
            char: 'f',
            required: true,
            description: messages.getMessage('configFileFlagDescription'),
        }),
        releasename: flags.string({
            char: 'n',
            required: true,
            description: messages.getMessage('releaseNameFlagDescription'),
        }),
        branchname: flags.string({
            char: 'b',
            description: messages.getMessage('branchNameFlagDescription'),
        }),
        directory: flags.string({
            char: 'd',
            description: messages.getMessage('directoryFlagDescription'),
        }),
        nopush: flags.boolean({
            description: messages.getMessage('noPushFlagDescription'),
            default:false
        }),
        forcepush: flags.boolean({
            description: messages.getMessage('forcePushFlagDescription'),
            dependsOn: ['push'],
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

    async execute(): Promise<any> {
        try {
            let releaseDefinitionGenerator: ReleaseDefinitionGenerator = new ReleaseDefinitionGenerator(
                new ConsoleLogger(),
                this.flags.gitref,
                this.flags.configfile,
                this.flags.releasename,
                this.flags.branchname,
                this.flags.directory,
                this.flags.nopush,
                this.flags.forcepush
            );
            return await releaseDefinitionGenerator.exec();
        } catch (err) {
            let errorMessage: string = '';
            if (err instanceof Array) {
                for (let e of err) {
                    errorMessage += e.message + `\n`;
                }
            } else {
                errorMessage = err.message;
            }
            console.log(errorMessage);

            process.exit(1);
        }
    }
}
