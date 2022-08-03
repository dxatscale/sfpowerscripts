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
        `$ sfdx sfpowerscripts:releasedefinition:generate -n <releaseName>  -b <branchName> -u <org>`,
    ];

    protected static requiresProject = true;
    protected static requiresUsername = true;
    protected static requiresDevhubUsername = false;

    protected static flagsConfig = {
        configfile: flags.string({
            char: 'f',
            required:true,
            description: messages.getMessage('configFileFlagDescription'),
        }),
        branchname: flags.string({
            char: 'b',
            description: messages.getMessage('branchNameFlagDescription'),
        }),
        push: flags.boolean({
            description: messages.getMessage('pushFlagDescription'),
            dependsOn: ['branchname'],
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

            //Create Org
            await this.org.refreshAuth();
            let sfpOrg: SFPOrg = await SFPOrg.create({ connection: this.org.getConnection() });

            let releaseDefinitionGenerator: ReleaseDefinitionGenerator = new ReleaseDefinitionGenerator(
                sfpOrg,
                this.flags.configfile,
                this.flags.branchname,
                this.flags.push,
                this.flags.forcepush,
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
