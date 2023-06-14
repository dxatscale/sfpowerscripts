import { flags } from '@salesforce/command';
import SfpowerscriptsCommand from '../../SfpowerscriptsCommand';
import SFPStatsSender from '@dxatscale/sfpowerscripts.core/lib/stats/SFPStatsSender';
import SFPLogger, { LoggerLevel, COLOR_KEY_MESSAGE } from '@dxatscale/sfp-logger';
import { Messages } from '@salesforce/core';

// Initialize Messages with the current plugin directory
Messages.importMessagesDirectory(__dirname);

// Load the specific messages for this file. Messages from @salesforce/command, @salesforce/core,
// or any library that is using the messages framework can also be loaded this way.
const messages = Messages.loadMessages('@dxatscale/sfpowerscripts', 'metrics_report');

export default class Report extends SfpowerscriptsCommand {
  public static description = messages.getMessage('commandDescription');

  protected static requiresDevhubUsername = false;
  protected static requiresProject = false;

  public static examples = ['$ sfpowerscripts metrics:report -m <metric> -t <type> -v <value>'];

  protected static flagsConfig = {
    metric: flags.string({
      description: 'metrics to publish',
      required: true,
      char: 'm',
    }),
    type: flags.enum({
      options: [
        'gauge',
        'counter',
        'timer',
      ],
      description: 'type of metric',
      required: true,
      char: 't',
    }),
    value: flags.string({
      description: 'value of metric',
      char: 'v',
    }),
    tags: flags.string({
      description: 'tags for metric',
      required: false,
      char: 'g',
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

  public async execute(): Promise<void> {
    this.validateEnvVars();

    switch (this.flags.type) {
      case 'gauge':
        SFPLogger.log(COLOR_KEY_MESSAGE(`Publishing Gauge Metric ${this.flags.metric} with value ${this.flags.value}`));
        SFPStatsSender.logGauge(this.flags.metric, this.flags.value, this.flags.tags?JSON.parse(this.flags.tags):undefined);
        break;
      case 'counter':
        SFPLogger.log(COLOR_KEY_MESSAGE(`Publishing Count Metric ${this.flags.metric}`));
        SFPStatsSender.logCount(this.flags.metric, this.flags.tags?JSON.parse(this.flags.tags):undefined);
        break;
      case 'timer':
        SFPLogger.log(COLOR_KEY_MESSAGE(`Publishing Elapsed Metric ${this.flags.metric} with value ${this.flags.value}`));
        SFPStatsSender.logElapsedTime(this.flags.metric, Number.parseInt(this.flags.value), this.flags.tags?JSON.parse(this.flags.tags):undefined);
        break;
      default:
        throw new Error('Invalid Metric Type');
    };


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

