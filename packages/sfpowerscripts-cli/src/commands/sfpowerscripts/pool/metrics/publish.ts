import { flags } from '@salesforce/command';
import SfpowerscriptsCommand from '../../../../SfpowerscriptsCommand';
import SFPStatsSender from '@dxatscale/sfpowerscripts.core/lib/stats/SFPStatsSender';
import PoolListImpl from '@dxatscale/sfpowerscripts.core/lib/scratchorg/pool/PoolListImpl';
import ScratchOrg from '@dxatscale/sfpowerscripts.core/lib/scratchorg/ScratchOrg';
import LimitsFetcher from '@dxatscale/sfpowerscripts.core/lib/limits/LimitsFetcher';
const Table = require('cli-table');
import SFPLogger, { LoggerLevel, COLOR_KEY_MESSAGE } from '@dxatscale/sfp-logger';
import { Messages } from '@salesforce/core';

// Initialize Messages with the current plugin directory
Messages.importMessagesDirectory(__dirname);

// Load the specific messages for this file. Messages from @salesforce/command, @salesforce/core,
// or any library that is using the messages framework can also be loaded this way.
const messages = Messages.loadMessages('@dxatscale/sfpowerscripts', 'scratchorg_pool_metrics_publish');

export default class Publish extends SfpowerscriptsCommand {
    public static description = messages.getMessage('commandDescription');

    protected static requiresDevhubUsername = true;
    protected static requiresProject = false;

    public static examples = ['$ sfdx sfpowerscripts:pool:metrics:publish -v <myDevHub>'];

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

        table.push(['sfpowerscripts.scratchorgs.active.remaining', remainingActiveScratchOrgs, devhubUserName]);
        table.push(['sfpowerscripts.scratchorgs.daily.remaining', remainingDailyScratchOrgs, devhubUserName]);

        SFPStatsSender.logGauge(`pool.footprint`, nPooledScratchOrgs);
        table.push(['sfpowerscripts.pool.footprint', nPooledScratchOrgs, '']);

        if (pools) {
            for (let pool of Object.entries(pools)) {
                SFPStatsSender.logGauge('pool.total', pool[1].nTotal, { poolName: pool[0] });
                SFPStatsSender.logGauge('pool.available', pool[1].nAvailable, { poolName: pool[0] });
                SFPStatsSender.logGauge('pool.inuse', pool[1].nInUse, { poolName: pool[0] });
                SFPStatsSender.logGauge('pool.provisioning', pool[1].nProvisioningInProgress, { poolName: pool[0] });

                table.push(['sfpowerscripts.pool.total', pool[1].nTotal, pool[0]]);
                table.push(['sfpowerscripts.pool.available', pool[1].nAvailable, pool[0]]);
                table.push(['sfpowerscripts.pool.inuse', pool[1].nInUse, pool[0]]);
                table.push(['sfpowerscripts.pool.provisioning', pool[1].nProvisioningInProgress, pool[0]]);
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
