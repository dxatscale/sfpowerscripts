import SFPLogger, { Logger, LoggerLevel } from '@dxatscale/sfp-logger';
import { NativeMetricSender } from '../NativeMetricSender';
import axios ,{AxiosInstance} from 'axios';



export class SplunkMetricSender extends NativeMetricSender {
    constructor(logger: Logger) {
        super(logger);
    }

    private instance: AxiosInstance;

    public initialize(apiHost: string, apiKey: string) {
          this.instance = axios.create({
            baseURL: apiHost,
            headers: {'Authorization': apiKey, 'Content-Type': 'application/json'}
          });
    }

    public sendGaugeMetric(metric: string, value: number, tags: string[] | { [key: string]: string }) {
        metric = `sfpowerscripts.${metric}`;
        const payload = {source: "sfpowerscripts",sourcetype: "metrics",event: {metric: metric, type: 'guage', value: value,tags: tags as { [key: string]: string },timestamp: Date.now()}};
        this.instance.post('', JSON.stringify(payload))
        .then((response) => {SFPLogger.log(`Transmitted metric ${metric} ${response.status}`, LoggerLevel.TRACE, this.logger)})
        .catch((error) => {
            SFPLogger.log(
                `Unable to transmit metrics for metric ${metric} due to` + error,
                LoggerLevel.WARN,
                this.logger
            );
        });
    }

    public sendCountMetric(metric: string, tags: string[] | { [key: string]: string }) {
        metric = `sfpowerscripts.${metric}`;
        const payload = {source: "sfpowerscripts",sourcetype: "metrics",metadata: {metric: metric, type: 'count', tags: tags as { [key: string]: string },timestamp: Date.now()}};
        this.instance.post('', JSON.stringify(payload))
        .then((response) => {SFPLogger.log(`Transmitted metric ${metric} ${response.status}`, LoggerLevel.TRACE, this.logger)})
        .catch((error) => {
            SFPLogger.log(
                `Unable to transmit metrics for metric ${metric} due to` + error,
                LoggerLevel.WARN,
                this.logger
            );
        });
    }
}

