import { flags } from '@salesforce/command';
import SfpowerscriptsCommand from '../../SfpowerscriptsCommand';
import { LoggerLevel, Messages } from '@salesforce/core';
import SFPOrg from '@dxatscale/sfpowerscripts.core/lib/org/SFPOrg';
import SFPLogger, { ConsoleLogger } from '@dxatscale/sfp-logger';
import { ZERO_BORDER_TABLE } from '../../ui/TableConstants';
const Table = require('cli-table');

Messages.importMessagesDirectory(__dirname);
const messages = Messages.loadMessages('@dxatscale/sfpowerscripts', 'artifacts_query');

export default class Query extends SfpowerscriptsCommand {
    public static description = messages.getMessage('commandDescription');

    public static examples = [`$ sfpowerscripts artifacts:query -u <target_org>`];

    protected static requiresUsername = true;
    protected static requiresDevhubUsername = false;

    protected static flagsConfig = {
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
        await this.org.refreshAuth();

        let sfpOrg: SFPOrg = await SFPOrg.create({ connection: this.org.getConnection() });
        let installedArtifacts = await sfpOrg.getAllInstalledArtifacts();
        if (!this.flags.json) {
            let minTable = new Table({
                head: [
                    'Package',
                    'Version in org',
                    'Commmit Id',
                    'Subcriber Version',
                    'Type',
                    'Is Sfpowerscripts Installed',
                ],
                chars: ZERO_BORDER_TABLE
            });
            installedArtifacts.forEach((installedArtifact) => {
                minTable.push([
                    installedArtifact.name,
                    installedArtifact.version,
                    installedArtifact.commitId.substring(0,8),
                    installedArtifact.subscriberVersion,
                    installedArtifact.type,
                    installedArtifact.isInstalledBySfpowerscripts,
                ]);
            });
            SFPLogger.log(minTable.toString(), LoggerLevel.INFO, new ConsoleLogger());
        } else {
            return installedArtifacts;
        }
    }
}
