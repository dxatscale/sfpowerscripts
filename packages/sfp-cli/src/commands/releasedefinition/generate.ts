import { ConsoleLogger } from '@flxblio/sfp-logger';
import { Messages } from '@salesforce/core';
import ReleaseDefinitionGenerator from '../../impl/release/ReleaseDefinitionGenerator';
import SfpCommand from '../../SfpCommand';
import { Flags } from '@oclif/core';
import { loglevel } from '../../flags/sfdxflags';

Messages.importMessagesDirectory(__dirname);
const messages = Messages.loadMessages('@flxblio/sfp', 'releasedefinition_generate');

export default class Generate extends SfpCommand {
    public static description = messages.getMessage('commandDescription');

    public static examples = [
        `$ sfp releasedefinition:generate -n <releaseName> -c <gitref> -f <configfile>`,
    ];

    protected static requiresProject = true;
    protected static requiresDevhubUsername = false;

    public static flags = {
        gitref: Flags.string({
            char: 'c',
            description: messages.getMessage('commitFlagDescription'),
            required: true
        }),
        configfile: Flags.string({
            char: 'f',
            required: true,
            description: messages.getMessage('configFileFlagDescription'),
        }),
        releasename: Flags.string({
            char: 'n',
            required: true,
            description: messages.getMessage('releaseNameFlagDescription'),
        }),
        branchname: Flags.string({
            char: 'b',
            description: messages.getMessage('branchNameFlagDescription'),
        }),
        directory: Flags.string({
            char: 'd',
            description: messages.getMessage('directoryFlagDescription'),
        }),
        nopush: Flags.boolean({
            description: messages.getMessage('noPushFlagDescription'),
            default:false
        }),
        forcepush: Flags.boolean({
            description: messages.getMessage('forcePushFlagDescription'),
            dependsOn: ['push'],
        }),
        metadata: Flags.string({
            char: 'm',
            description: messages.getMessage('metadataFlagDescription'),
        }),
        loglevel
    };

    async execute(): Promise<any> {
        try {
            let releaseDefinitionGenerator: ReleaseDefinitionGenerator = new ReleaseDefinitionGenerator(
                new ConsoleLogger(),
                this.flags.gitref,
                this.flags.configfile,
                this.flags.releasename,
                this.flags.branchname,
                this.flags.metadata,
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
