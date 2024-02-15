import { ConsoleLogger } from '@flxblio/sfp-logger';
import { Messages } from '@salesforce/core';
import ChangelogImpl from '../../impl/changelog/ChangelogImpl';
import SfpCommand from '../../SfpCommand';
import { Flags } from '@oclif/core';
import { loglevel } from '../../flags/sfdxflags';

Messages.importMessagesDirectory(__dirname);
const messages = Messages.loadMessages('@flxblio/sfp', 'generate_changelog');

export default class GenerateChangelog extends SfpCommand {
    
    public static description = messages.getMessage('commandDescription');

    public static examples = [
        `$ sfp changelog:generate -n <releaseName> -d path/to/artifact/directory -w <regexp> -r <repoURL> -b <branchName>`,
    ];

    protected static requiresUsername = false;
    protected static requiresDevhubUsername = false;

    public static flags = {
        limit: Flags.integer({
            description: messages.getMessage('limitFlagDescription'),
        }),
        artifactdir: Flags.directory({
            required: true,
            char: 'd',
            description: messages.getMessage('artifactDirectoryFlagDescription'),
            default: 'artifacts',
        }),
        releasename: Flags.string({
            required: true,
            char: 'n',
            description: messages.getMessage('releaseNameFlagDescription'),
        }),
        workitemfilter: Flags.string({
            required: true,
            char: 'w',
            description: messages.getMessage('workItemFilterFlagDescription'),
        }),
        workitemurl: Flags.string({
            required: false,
            description: messages.getMessage('workItemUrlFlagDescription'),
        }),
        repourl: Flags.string({
            required: false,
            char: 'r',
            description: messages.getMessage('repoUrlFlagDescription'),
            deprecated: {message:'--repourl has been deprecated'}
        }),
        directory: Flags.string({
            required: false,
            description: messages.getMessage('directoryFlagDescription'),
        }),
        branchname: Flags.string({
            required: true,
            char: 'b',
            description: messages.getMessage('branchNameFlagDescription'),
        }),
        nopush: Flags.boolean({
            description: messages.getMessage('noPushFlagDescription'),
            dependsOn: ['branchname'],
            default: false
        }),
        showallartifacts: Flags.boolean({
            required: false,
            description: messages.getMessage('showAllArtifactsFlagDescription'),
        }),
        forcepush: Flags.boolean({
            description: messages.getMessage('forcePushFlagDescription'),
            hidden: true,
            default: false,
        }),
        loglevel,
    };

    async execute() {
        try {
            let changelogImpl: ChangelogImpl = new ChangelogImpl(
                new ConsoleLogger(),
                this.flags.artifactdir,
                this.flags.releasename,
                this.flags.workitemfilter.split(':'),
                this.flags.limit,
                this.flags.workitemurl,
                this.flags.showallartifacts,
                this.flags.directory,
                this.flags.forcepush,
                this.flags.branchname,
                this.flags.nopush,
                false,
                undefined,
                null
            );

            await changelogImpl.exec();
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
