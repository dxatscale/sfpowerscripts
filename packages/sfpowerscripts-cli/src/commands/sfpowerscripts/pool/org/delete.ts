import { flags } from '@salesforce/command';
import { AnyJson } from '@salesforce/ts-types';
import SfpowerscriptsCommand from '../../../../SfpowerscriptsCommand';
import PoolOrgDeleteImpl from '@dxatscale/sfpowerscripts.core/lib/scratchorg/pool/PoolOrgDeleteImpl';
import SFPLogger from '@dxatscale/sfp-logger';
import { Messages } from '@salesforce/core';

// Initialize Messages with the current plugin directory
Messages.importMessagesDirectory(__dirname);

// Load the specific messages for this file. Messages from @salesforce/command, @salesforce/core,
// or any library that is using the messages framework can also be loaded this way.
const messages = Messages.loadMessages('@dxatscale/sfpowerscripts', 'scratchorg_pool_org_delete');

export default class Delete extends SfpowerscriptsCommand {
    public static description = messages.getMessage('commandDescription');

    protected static requiresDevhubUsername = true;

    public static examples = [`$ sfdx sfpowerscripts:pool:org:delete -u test-xasdasd@example.com -v devhub`];

    protected static flagsConfig = {
        username: flags.string({
            char: 'u',
            description: messages.getMessage('userNameFlagDescription'),
            required: true,
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

    public async execute(): Promise<AnyJson> {
        await this.hubOrg.refreshAuth();
        const hubConn = this.hubOrg.getConnection();

        this.flags.apiversion = this.flags.apiversion || (await hubConn.retrieveMaxApiVersion());

        let poolOrgDeleteImpl = new PoolOrgDeleteImpl(this.hubOrg, this.flags.username);

        await poolOrgDeleteImpl.execute();
        if (!this.flags.json) SFPLogger.log(`Scratch org with username ${this.flags.username} is deleted successfully`);

        return { username: this.flags.username, messages: 'Scratch Org deleted Succesfully' } as AnyJson;
    }
}
