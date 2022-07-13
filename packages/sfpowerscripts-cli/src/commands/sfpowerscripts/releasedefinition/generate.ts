import SFPOrg from '@dxatscale/sfpowerscripts.core/lib/org/SFPOrg';
import { flags } from '@salesforce/command';
import { Messages } from '@salesforce/core';
import ReleaseDefinitionGenerator from '../../../impl/release/ReleaseDefinitionGenerator';
import SfpowerscriptsCommand from '../../../SfpowerscriptsCommand';
import Git from '@dxatscale/sfpowerscripts.core/lib/git/Git';
import { ReleaseChangelog } from '../../../impl/changelog/ReleaseChangelogInterfaces';

Messages.importMessagesDirectory(__dirname);
const messages = Messages.loadMessages('@dxatscale/sfpowerscripts', 'releasedefinition_generate');

export default class Generate extends SfpowerscriptsCommand {
    public static description = messages.getMessage('commandDescription');

    public static examples = [
        `$ sfdx sfpowerscripts:releasedefinition:generate -n <releaseName>  -b <branchName> -u <org>`,
    ];

    protected static requiresProject = true;
    protected static requiresUsername = true;
    protected static requiresDevhubUsername = false;

    protected static flagsConfig = {
        releasename: flags.string({
            char: 'n',
            description: messages.getMessage('releaseNameFlagDescription'),
        }),
        changelogbranchref: flags.string({
            char: 'c',
            exclusive: ['releasename'],
            description: messages.getMessage('changelogbranchrefDescrption'),
        }),
        push: flags.boolean({
            description: messages.getMessage('pushFlagDescription'),
            default: false,
        }),
        branchname: flags.string({
            char: 'b',
            dependsOn: ['push'],
            description: messages.getMessage('branchNameFlagDescription'),
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

            if(this.flags.changelogbranchref==null && this.flags.releasename==null)
              throw Error(`Either --changelogbranchref or --releasename should be set`)

            //Create Org
            await this.org.refreshAuth();
            let sfpOrg: SFPOrg = await SFPOrg.create({ connection: this.org.getConnection() });

            //grab release name from changelog.json
            let releaseName;
            if (this.flags.changelogbranchref) {
                const git: Git = new Git(null);
                await git.fetch();

                if (!this.flags.changelogbranchref.includes('origin')) {
                    // for user convenience, use full ref name to avoid errors involving missing local refs
                    this.flags.changelogbranchref= `remotes/origin/${this.flags.changelogbranchref}`;
                }

                let changelogFileContents = await git.show([`${this.flags.changelogbranchref}:releasechangelog.json`])
                let changelog: ReleaseChangelog = JSON.parse(changelogFileContents);
                //Get last release name and sanitize it
                let release = changelog.releases.pop()
                let name = release.names.pop();
                let buildNumber = release.buildNumber;
                releaseName = name.replace(/[/\\?%*:|"<>]/g, '-').concat(`-`, buildNumber.toString());
            } else {
                releaseName = this.flags.releaseName;
            }

            let releaseDefinitionGenerator: ReleaseDefinitionGenerator = new ReleaseDefinitionGenerator(
                sfpOrg,
                releaseName,
                this.flags.branchname,
                this.flags.push,
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
