import SfpCommand from '../../../SfpCommand';
import SFPStatsSender from '../../../core/stats/SFPStatsSender';
import PoolListImpl from '../../../core/scratchorg/pool/PoolListImpl';
import ScratchOrg from '../../../core/scratchorg/ScratchOrg';
import LimitsFetcher from '../../../core/limits/LimitsFetcher';
const Table = require('cli-table');
import SFPLogger, { LoggerLevel, COLOR_KEY_MESSAGE } from '@flxblio/sfp-logger';
import { Messages } from '@salesforce/core';
import { loglevel, targetdevhubusername } from '../../../flags/sfdxflags';

// Initialize Messages with the current plugin directory
Messages.importMessagesDirectory(__dirname);

// Load the specific messages for this file. Messages from @salesforce/command, @salesforce/core,
// or any library that is using the messages framework can also be loaded this way.
const messages = Messages.loadMessages('@flxblio/sfp', 'scratchorg_pool_metrics_publish');

export default class Publish extends SfpCommand {
    public static description = messages.getMessage('commandDescription');

    protected static requiresDevhubUsername = true;
    protected static requiresProject = false;

    public static examples = ['$ sfp pool:metrics:publish -v <myDevHub>'];

    public static flags = {
       targetdevhubusername,
       loglevel
    };

    public async execute(): Promise<void> {
        this.validateEnvVars();

        let nPooledScratchOrgs: number = 0;
        let pools: { [p: string]: poolMetrics };

        try {
            const listOfScratchOrgs = (await new PoolListImpl(this.hubOrg, null, true).execute()) as ScratchOrg[];

            nPooledScratchOrgs = listOfScratchOrgs.length ? listOfScratchOrgs.length : 0;
            pools = this.getMetricsForEachPool(listOfScratchOrgs);
        } catch (err) {
            SFPLogger.log(
                `Failed to get metrics for scratch org pools. Ensure prerequisites are installed for pooling.`,
                LoggerLevel.TRACE
            );
        }

        const table = new Table({
            head: ['Metric', 'Value', 'Tag'],
        });

        const limits = await new LimitsFetcher(this.hubOrg.getConnection()).getApiLimits();
        const remainingActiveScratchOrgs = limits.find((limit) => limit.name === 'ActiveScratchOrgs').remaining;
        const remainingDailyScratchOrgs = limits.find((limit) => limit.name === 'DailyScratchOrgs').remaining;
        const devhubUserName = this.hubOrg.getUsername()

        SFPStatsSender.logGauge(`scratchorgs.active.remaining`, remainingActiveScratchOrgs, {target_org: devhubUserName});
        SFPStatsSender.logGauge(`scratchorgs.daily.remaining`, remainingDailyScratchOrgs, {target_org: devhubUserName});

        table.push(['sfp.scratchorgs.active.remaining', remainingActiveScratchOrgs, devhubUserName]);
        table.push(['sfp.scratchorgs.daily.remaining', remainingDailyScratchOrgs, devhubUserName]);

        SFPStatsSender.logGauge(`pool.footprint`, nPooledScratchOrgs);
        table.push(['sfp.pool.footprint', nPooledScratchOrgs, '']);

        if (pools) {
            for (let pool of Object.entries(pools)) {
                SFPStatsSender.logGauge('pool.total', pool[1].nTotal, { poolName: pool[0] });
                SFPStatsSender.logGauge('pool.available', pool[1].nAvailable, { poolName: pool[0] });
                SFPStatsSender.logGauge('pool.inuse', pool[1].nInUse, { poolName: pool[0] });
                SFPStatsSender.logGauge('pool.provisioning', pool[1].nProvisioningInProgress, { poolName: pool[0] });

                table.push(['sfp.pool.total', pool[1].nTotal, pool[0]]);
                table.push(['sfp.pool.available', pool[1].nAvailable, pool[0]]);
                table.push(['sfp.pool.inuse', pool[1].nInUse, pool[0]]);
                table.push(['sfp.pool.provisioning', pool[1].nProvisioningInProgress, pool[0]]);
            }
        }

        SFPLogger.log(COLOR_KEY_MESSAGE('Metrics published:'), LoggerLevel.INFO);
        SFPLogger.log(table.toString(), LoggerLevel.INFO);
    }

    private getMetricsForEachPool(listOfScratchOrgs: ScratchOrg[]) {
        const pools: { [p: string]: poolMetrics } = {};

        listOfScratchOrgs.forEach((scratchOrg) => {
            if (!pools[scratchOrg.tag]) {
                pools[scratchOrg.tag] = {
                    nTotal: 0,
                    nAvailable: 0,
                    nInUse: 0,
                    nProvisioningInProgress: 0,
                };
            }
            if (scratchOrg.status === 'Available') {
                pools[scratchOrg.tag].nAvailable++;
            } else if (scratchOrg.status === 'In use') {
                pools[scratchOrg.tag].nInUse++;
            } else if (scratchOrg.status === 'Provisioning in progress') {
                pools[scratchOrg.tag].nProvisioningInProgress++;
            }

            pools[scratchOrg.tag].nTotal =
                pools[scratchOrg.tag].nAvailable +
                pools[scratchOrg.tag].nInUse +
                pools[scratchOrg.tag].nProvisioningInProgress;
        });

        return pools;
    }

    private validateEnvVars() {
        if (
            !(
                process.env.SFPOWERSCRIPTS_STATSD ||
                process.env.SFPOWERSCRIPTS_DATADOG ||
                process.env.SFPOWERSCRIPTS_NEWRELIC ||
                process.env.SFPOWERSCRIPTS_SPLUNK
            )
        ) {
            throw new Error('Environment variable not set for metrics. No metrics will be published.');
        }
    }
}

interface poolMetrics {
    nTotal: number;
    nAvailable: number;
    nInUse: number;
    nProvisioningInProgress: number;
}
