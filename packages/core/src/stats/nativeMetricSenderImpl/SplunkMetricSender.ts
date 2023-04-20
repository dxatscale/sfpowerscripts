import SFPLogger, { Logger, LoggerLevel } from '@dxatscale/sfp-logger';
import { NativeMetricSender } from '../NativeMetricSender';
import { Logger as SplunkLogger,SendContextMetadata,SendContext } from 'splunk-logging'



export class SplunkMetricSender extends NativeMetricSender {
    constructor(logger: Logger) {
        super(logger);
    }

    private splunkMetricLogger: SplunkLogger;
    private payload: SendContextMetadata & SendContext

    public initialize(apiHost: string, apiKey: string) {
        try {
            this.splunkMetricLogger = new SplunkLogger({ 
                token: apiKey,
                url: apiHost, // e.g. https://localhost:8088/services/collector/event
                maxBatchCount: 0 // Manually flush events
             });
        } catch (error) {
            SFPLogger.log(`Unable to intialize native newrelic metric logger ${error}`, LoggerLevel.WARN, this.logger);
        }
    }

    public sendGaugeMetric(metric: string, value: number, tags: string[] | { [key: string]: string }) {
        metric = `sfpowerscripts.${metric}`;
        this.payload = {metadata: {source: "sfpowerscripts",sourcetype: "metrics"}, message: {metric: metric, type: 'guage', value: value,tags: tags as { [key: string]: string }}};
        this.splunkMetricLogger.send(this.payload);
        this.splunkMetricLogger.flush((error, response, body) => {
            if (response) {
                SFPLogger.log(`Transmitted metric ${metric} ${response.statusCode}`, LoggerLevel.TRACE, this.logger);
            }
            if (error)
                SFPLogger.log(
                    `Unable to transmit metrics for metric ${metric} due to` + error,
                    LoggerLevel.WARN,
                    this.logger
                );
        });
    }

    public sendCountMetric(metric: string, tags: string[] | { [key: string]: string }) {
        metric = `sfpowerscripts.${metric}`;
        this.payload = {metadata: {source: "sfpowerscripts",sourcetype: "metrics"}, message: {metric: metric, type: 'count', tags: tags as { [key: string]: string }}};
        this.splunkMetricLogger.send(this.payload);
        this.splunkMetricLogger.flush((error, response, body) => {
            if (response) {
                SFPLogger.log(`Transmitted metric ${metric} ${response.statusCode}`, LoggerLevel.TRACE, this.logger);
            }
            if (error)
                SFPLogger.log(
                    `Unable to transmit metrics for metric ${metric} due to` + error,
                    LoggerLevel.WARN,
                    this.logger
                );
        });
    }
}
