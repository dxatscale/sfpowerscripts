import SfpCommand from '../../SfpCommand';
import { LoggerLevel, Messages } from '@salesforce/core';
import SFPOrg from '../../core/org/SFPOrg';
import SFPLogger, { ConsoleLogger } from '@flxblio/sfp-logger';
import { ZERO_BORDER_TABLE } from '../../ui/TableConstants';
import { loglevel, requiredUserNameFlag } from '../../flags/sfdxflags';
const Table = require('cli-table');

Messages.importMessagesDirectory(__dirname);
const messages = Messages.loadMessages('@flxblio/sfp', 'artifacts_query');

export default class Query extends SfpCommand {
    public static description = messages.getMessage('commandDescription');

    public static examples = [`$ sfp artifacts:query -u <target_org>`];
    public static enableJsonFlag = true
    protected static requiresUsername = true;
    protected static requiresDevhubUsername = false;

    public static flags = {
        loglevel,
        'targetusername': requiredUserNameFlag,
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
                    'Is sfp Installed',
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
                    installedArtifact.isInstalledBysfp,
                ]);
            });
            SFPLogger.log(minTable.toString(), LoggerLevel.INFO, new ConsoleLogger());
        } else {
            return installedArtifacts;
        }
    }
}
