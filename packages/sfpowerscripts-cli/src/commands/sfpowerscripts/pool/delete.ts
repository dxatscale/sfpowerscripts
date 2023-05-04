import { flags, SfdxCommand } from '@salesforce/command';
import { Messages } from '@salesforce/core';
import PoolDeleteImpl from '@dxatscale/sfpowerscripts.core/lib/scratchorg/pool/PoolDeleteImpl';
import OrphanedOrgsDeleteImpl from '@dxatscale/sfpowerscripts.core/lib/scratchorg/pool/OrphanedOrgsDeleteImpl';
import ScratchOrg from '@dxatscale/sfpowerscripts.core/lib/scratchorg/ScratchOrg';
import SfpowerscriptsCommand from '../../../SfpowerscriptsCommand';
import { ZERO_BORDER_TABLE } from '../../../ui/TableConstants';
import SFPLogger, { ConsoleLogger, LoggerLevel } from '@dxatscale/sfp-logger';
import { COLOR_KEY_MESSAGE } from '@dxatscale/sfp-logger';
import { COLOR_WARNING } from '@dxatscale/sfp-logger';
const Table = require('cli-table');

// Initialize Messages with the current plugin directory
Messages.importMessagesDirectory(__dirname);

// Load the specific messages for this file. Messages from @salesforce/command, @salesforce/core,
// or any library that is using the messages framework can also be loaded this way.
const messages = Messages.loadMessages('@dxatscale/sfpowerscripts', 'pool_delete');

export default class Delete extends SfpowerscriptsCommand {
    public static description = messages.getMessage('commandDescription');

    protected static requiresDevhubUsername = true;

    public static examples = [
        `$ sfdx sfpowerscripts:pool:delete -t core `,
        `$ sfdx sfpowerscripts:pool:delete -t core -v devhub`,
        `$ sfdx sfpowerscripts:pool:delete --orphans -v devhub`,
    ];

    protected static flagsConfig = {
        tag: flags.string({
            char: 't',
            description: messages.getMessage('tagDescription'),
            required: false,
        }),
        allscratchorgs: flags.boolean({
            char: 'a',
            description: messages.getMessage('allscratchorgsDescription'),
            required: false,
        }),
        inprogressonly: flags.boolean({
            char: 'i',
            description: messages.getMessage('inprogressonlyDescription'),
            required: false,
            exclusive: ['allscratchorgs'],
        }),
        orphans: flags.boolean({
            char: 'o',
            description: messages.getMessage('recoverOrphanedScratchOrgsDescription'),
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
