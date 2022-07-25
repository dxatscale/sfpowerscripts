import { BufferedMetricsLogger } from 'datadog-metrics';
import SFPLogger, { Logger, LoggerLevel } from '@dxatscale/sfp-logger';
import { NativeMetricSender } from '../NativeMetricSender';

export class DataDogMetricsSender extends NativeMetricSender {
    constructor(logger: Logger) {
        super(logger);
    }

    private nativeDataDogMetricsLogger: BufferedMetricsLogger;

    public initialize(apiHost: string, apiKey: string) {
        try {
            this.nativeDataDogMetricsLogger = new BufferedMetricsLogger({
                apiHost: apiHost,
                apiKey: apiKey,
                prefix: 'sfpowerscripts.',
                flushIntervalSeconds: 0,
            });
        } catch (error) {
            SFPLogger.log('Unable to intialize native datadog logger' + error, LoggerLevel.TRACE, this.logger);
        }
    }

    public sendGaugeMetric(metric: string, value: number, tags: string[] | { [key: string]: string }) {
        try {
            let transformedTags = this.transformTagsToStringArray(tags);
            this.nativeDataDogMetricsLogger.gauge(metric, value, transformedTags);
            this.nativeDataDogMetricsLogger.flush();
        } catch (error) {
            SFPLogger.log(
                `Unable to transmit metrics for metric ${metric} due to` + error,
                LoggerLevel.TRACE,
                this.logger
            );
        }
    }

    public sendCountMetric(metric: string, tags: string[] | { [key: string]: string }) {
        try {
            let transformedTags = this.transformTagsToStringArray(tags);
            this.nativeDataDogMetricsLogger.increment(metric, 1, transformedTags);
            this.nativeDataDogMetricsLogger.flush();
        } catch (error) {
            SFPLogger.log(
                `Unable to transmit metrics for metric ${metric} due to` + error,
                LoggerLevel.TRACE,
                this.logger
            );
        }
    }
}
