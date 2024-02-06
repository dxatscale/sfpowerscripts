import SfpCommand from '../../SfpCommand';
import SFPStatsSender from '../../core/stats/SFPStatsSender';
import SFPLogger, { LoggerLevel, COLOR_KEY_MESSAGE } from '@flxblio/sfp-logger';
import { Messages } from '@salesforce/core';
import { Flags } from '@oclif/core';
import { loglevel } from '../../flags/sfdxflags';

// Initialize Messages with the current plugin directory
Messages.importMessagesDirectory(__dirname);

// Load the specific messages for this file. Messages from @salesforce/command, @salesforce/core,
// or any library that is using the messages framework can also be loaded this way.
const messages = Messages.loadMessages('@flxblio/sfp', 'metrics_report');

export default class Report extends SfpCommand {
  public static description = messages.getMessage('commandDescription');

  protected static requiresDevhubUsername = false;
  protected static requiresProject = false;

  public static examples = ['$ sfp metrics:report -m <metric> -t <type> -v <value>'];

  public static flags = {
    metric: Flags.string({
      description: 'metrics to publish',
      required: true,
      char: 'm',
    }),
    type: Flags.string({
      options: [
        'gauge',
        'counter',
        'timer',
      ],
      description: 'type of metric',
      required: true,
      char: 't',
    }),
    value: Flags.string({
      description: 'value of metric',
      char: 'v',
    }),
    tags: Flags.string({
      description: 'tags for metric',
      required: false,
      char: 'g',
    }),
    loglevel
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

