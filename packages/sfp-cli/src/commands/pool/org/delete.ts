import { AnyJson } from '@salesforce/ts-types';
import SfpCommand from '../../../SfpCommand';
import PoolOrgDeleteImpl from '../../../core/scratchorg/pool/PoolOrgDeleteImpl';
import SFPLogger from '@flxblio/sfp-logger';
import { Messages } from '@salesforce/core';
import {
    loglevel,
    orgApiVersionFlagSfdxStyle,
    targetdevhubusername,
    requiredUserNameFlag,
} from '../../../flags/sfdxflags';
import { AliasAccessor } from '@salesforce/core/lib/stateAggregator/accessors/aliasAccessor';


// Initialize Messages with the current plugin directory
Messages.importMessagesDirectory(__dirname);

// Load the specific messages for this file. Messages from @salesforce/command, @salesforce/core,
// or any library that is using the messages framework can also be loaded this way.
const messages = Messages.loadMessages('@flxblio/sfp', 'scratchorg_pool_org_delete');

export default class Delete extends SfpCommand {
    public static description = messages.getMessage('commandDescription');

    protected static requiresDevhubUsername = true;

    public static examples = [`$ sfp pool:org:delete -u test-xasdasd@example.com -v devhub`];

    public static flags = {
        apiversion: orgApiVersionFlagSfdxStyle,
        targetusername: requiredUserNameFlag,
        targetdevhubusername,
        loglevel,
    };

    public async execute(): Promise<AnyJson> {
        await this.hubOrg.refreshAuth();
        const hubConn = this.hubOrg.getConnection();

        this.flags.apiversion = this.flags.apiversion || (await hubConn.retrieveMaxApiVersion());

        let aliasAccessor = await AliasAccessor.create();
        let resolvedAliasOrUserName:string;
        if (aliasAccessor.resolveAlias(this.flags.targetusername)) {
            resolvedAliasOrUserName = aliasAccessor.resolveUsername(this.flags.targetusername);
        } else {
            resolvedAliasOrUserName = this.flags.targetusername;
        }

        let poolOrgDeleteImpl = new PoolOrgDeleteImpl(this.hubOrg, resolvedAliasOrUserName);

        await poolOrgDeleteImpl.execute();
        if (!this.flags.json)
            SFPLogger.log(`Scratch org with username or alias ${this.flags.targetusername} is deleted successfully`);

        return { username: this.flags.username, messages: 'Scratch Org deleted Succesfully' } as AnyJson;
    }
}
