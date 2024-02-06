import { Messages } from '@salesforce/core';
import PoolDeleteImpl from '../../core/scratchorg/pool/PoolDeleteImpl';
import OrphanedOrgsDeleteImpl from '../../core/scratchorg/pool/OrphanedOrgsDeleteImpl';
import ScratchOrg from '../../core/scratchorg/ScratchOrg';
import SfpCommand from '../../SfpCommand';
import { ZERO_BORDER_TABLE } from '../../ui/TableConstants';
import SFPLogger, { ConsoleLogger, LoggerLevel } from '@flxblio/sfp-logger';
import { COLOR_KEY_MESSAGE } from '@flxblio/sfp-logger';
import { COLOR_WARNING } from '@flxblio/sfp-logger';
import { Flags } from '@oclif/core';
import { loglevel, orgApiVersionFlagSfdxStyle, targetdevhubusername } from '../../flags/sfdxflags';
const Table = require('cli-table');

// Initialize Messages with the current plugin directory
Messages.importMessagesDirectory(__dirname);

// Load the specific messages for this file. Messages from @salesforce/command, @salesforce/core,
// or any library that is using the messages framework can also be loaded this way.
const messages = Messages.loadMessages('@flxblio/sfp', 'pool_delete');

export default class Delete extends SfpCommand {
    public static description = messages.getMessage('commandDescription');

    protected static requiresDevhubUsername = true;

    public static examples = [
        `$ sfp pool:delete -t core `,
        `$ sfp pool:delete -t core -v devhub`,
        `$ sfp pool:delete --orphans -v devhub`,
    ];

    public static flags = {
        targetdevhubusername,
        tag: Flags.string({
            char: 't',
            description: messages.getMessage('tagDescription'),
            required: false,
        }),
        allscratchorgs: Flags.boolean({
            char: 'a',
            description: messages.getMessage('allscratchorgsDescription'),
            required: false,
        }),
        inprogressonly: Flags.boolean({
            char: 'i',
            description: messages.getMessage('inprogressonlyDescription'),
            required: false,
            exclusive: ['allscratchorgs'],
        }),
        orphans: Flags.boolean({
            char: 'o',
            description: messages.getMessage('recoverOrphanedScratchOrgsDescription'),
            required: false,
        }),
        'apiversion': orgApiVersionFlagSfdxStyle,
        loglevel,
    };

    public async execute(): Promise<{ orgId: string; username: string; operation: string }[]> {
        await this.hubOrg.refreshAuth();
        const hubConn = this.hubOrg.getConnection();

        this.flags.apiversion = this.flags.apiversion || (await hubConn.retrieveMaxApiVersion());

        let scratchOrgOperationResults: { orgId: string; username: string; operation: string }[] = [];
        //User want to delete orphans only
        if (this.flags.orphans && !this.flags.tag) {
            let orphanedOrgsDeleteImpl = new OrphanedOrgsDeleteImpl(this.hubOrg, new ConsoleLogger());
            let recoveredScratchOrgs = (await orphanedOrgsDeleteImpl.execute()) as ScratchOrg[];
            this.pushToResults('recovered', recoveredScratchOrgs, scratchOrgOperationResults);
        } else {
            let poolDeleteImpl = new PoolDeleteImpl(
                this.hubOrg,
                this.flags.tag,
                this.flags.mypool,
                this.flags.allscratchorgs,
                this.flags.inprogressonly,
                new ConsoleLogger()
            );

            let deletedOrgs = (await poolDeleteImpl.execute()) as ScratchOrg[];
            this.pushToResults('deleted', deletedOrgs, scratchOrgOperationResults);

            let orphanedOrgsDeleteImpl = new OrphanedOrgsDeleteImpl(this.hubOrg, new ConsoleLogger());
            let recoverdScratchOrgs = (await orphanedOrgsDeleteImpl.execute()) as ScratchOrg[];
            this.pushToResults('recovered', recoverdScratchOrgs, scratchOrgOperationResults);
        }
        this.displayScrathOrgOperationsAsTable(scratchOrgOperationResults);
        return scratchOrgOperationResults;
    }

    private pushToResults(
        operation: string,
        scratchOrgs: ScratchOrg[],
        result: { orgId: string; username: string; operation: string }[]
    ) {
        for (const scratchOrg of scratchOrgs) {
            result.push({ orgId: scratchOrg.orgId, username: scratchOrg.username, operation: operation });
        }
    }

    private displayScrathOrgOperationsAsTable(
        scratchOrgOperationResults: { orgId: string; username: string; operation: string }[]
    ) {
        const table = new Table({
            head: ['Operation', 'OrgId', 'Username'],
            chars: ZERO_BORDER_TABLE,
        });

        if (scratchOrgOperationResults.length > 0) {
            scratchOrgOperationResults.forEach((scratchOrgOperation) => {
                table.push([COLOR_KEY_MESSAGE(scratchOrgOperation.operation), scratchOrgOperation.orgId, scratchOrgOperation.username]);
            });

            SFPLogger.log(`The command resulted in the following operation`, LoggerLevel.INFO, new ConsoleLogger());
            SFPLogger.log(table.toString(), LoggerLevel.INFO, new ConsoleLogger());
        } else {
            SFPLogger.log(
                `${COLOR_WARNING(`No Scratch Orgs were found to be operated upon, The command will now exit`)}`,
                LoggerLevel.INFO,
                new ConsoleLogger()
            );
        }
    }
}
