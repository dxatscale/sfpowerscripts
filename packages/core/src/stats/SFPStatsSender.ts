import StatsDClient, { ClientOptions, StatsD } from "hot-shots";
import * as fs from "fs-extra";
import { EOL } from "os";
import { NativeMetricSender } from "./NativeMetricSender";
import { DataDogMetricsSender } from "./nativeMetricSenderImpl/DataDogMetricSender";
import { Logger } from "../logger/SFPLogger";
import { NewRelicMetricSender } from "./nativeMetricSenderImpl/NewRelicMetricSender";


export default class SFPStatsSender {
  private static client: StatsD;
  private static metricsLogger;
  private static nativeMetricsSender:NativeMetricSender;
  

  static initialize(port: string, host: string, protocol: string) {
    let options: ClientOptions = {
      host: host,
      port: port == null ? 8125 : Number(port),
      protocol: protocol == "tcp" ? "tcp" : "udp",
      prefix: "sfpowerscripts."
    };
    SFPStatsSender.client = new StatsDClient(options);
  }

  static initializeNativeMetrics(type:string, apiHost: string, apiKey: string,logger?:Logger) 
  {
    switch(type)
    {
      case 'DataDog':
               this.nativeMetricsSender = new DataDogMetricsSender(logger);
               this.nativeMetricsSender.initialize(apiHost, apiKey);
              break;
    
     case 'NewRelic':
               this.nativeMetricsSender = new NewRelicMetricSender(logger);
               this.nativeMetricsSender.initialize(apiHost, apiKey);
              break;

    default:  
           throw new Error("Invalid Metric Type");
    }
  }

  static initializeLogBasedMetrics() {
    try {
      fs.mkdirpSync(".sfpowerscripts/logs");
      SFPStatsSender.metricsLogger = `.sfpowerscripts/logs/metrics.log`;
    } catch (error) {
      console.log("Unable to initiate Log based metrics", error);
    }
  }

 

  static logElapsedTime(
    metric: string,
    elapsedMilliSeconds: number,
    tags?: { [key: string]: string } | string[]
  ) {
    if (SFPStatsSender.client != null)
      SFPStatsSender.client.timing(metric, elapsedMilliSeconds, tags);

    //Native Datadog integration
    if (SFPStatsSender.nativeMetricsSender != null) {
      SFPStatsSender.nativeMetricsSender.sendGaugeMetric(metric, elapsedMilliSeconds, tags);
    }

    let metrics = {
      metric: `sfpowerscripts.${metric}`,
      type: `timers`,
      value: elapsedMilliSeconds,
      timestamp: Date.now(),
      tags: tags,
    };
    SFPStatsSender.logMetrics(metrics, SFPStatsSender.metricsLogger);
  }

  static logGauge(
    metric: string,
    value: number,
    tags?: { [key: string]: string } | string[]
  ) {
    if (SFPStatsSender.client != null)
      SFPStatsSender.client.gauge(metric, value, tags);

    //Native Metrics integration
    if (SFPStatsSender.nativeMetricsSender != null) {
      SFPStatsSender.nativeMetricsSender.sendGaugeMetric(metric, value, tags);
    }

    let metrics = {
      metric: `sfpowerscripts.${metric}`,
      type: `guage`,
      value: value,
      timestamp: Date.now(),
      tags: tags,
    };
    SFPStatsSender.logMetrics(metrics, SFPStatsSender.metricsLogger);
  }

  
  static logCount(metric: string, tags?: { [key: string]: string } | string[]) {
    if (SFPStatsSender.client != null)
      SFPStatsSender.client.increment(metric, tags);

    //Native Metrics integration
    if (SFPStatsSender.nativeMetricsSender != null) {
      SFPStatsSender.nativeMetricsSender.sendCountMetric(metric, tags);
    }

    let metrics = {
      metric: `sfpowerscripts.${metric}`,
      type: `count`,
      timestamp: Date.now(),
      tags: tags,
    };
    SFPStatsSender.logMetrics(metrics, SFPStatsSender.metricsLogger);
  }

  
  static logMetrics(key: any, logger?: any) {
    if (logger) {
      fs.appendFileSync(logger, `${JSON.stringify(key)}${EOL}`, "utf8");
    }
  }


}
