import StatsDClient, { ClientOptions, StatsD } from "hot-shots";
import * as fs from "fs-extra";
import { EOL } from "os";

export default class SFPStatsSender {
  private static client: StatsD;
  private static metricsLogger;

  static initialize(
    port: string,
    host: string,
    protocol: string
  ) {
    let options: ClientOptions = {
      host: host,
      port: port == null ? 8125 : Number(port),
      protocol: protocol == "tcp" ? "tcp" : "udp",
      prefix: "sfpowerscripts."
    };
    SFPStatsSender.client = new StatsDClient(options);
  }

  static initializeLogBasedMetrics()
  {
    try
    {
    fs.mkdirpSync(".sfpowerscripts/logs");
    SFPStatsSender.metricsLogger = `.sfpowerscripts/logs/metrics.log`;
    }
    catch(error)
    {
      console.log("Unable to initiate Log based metrics",error);
    }
  }


  static logElapsedTime(metric: string, elapsedMilliSeconds: number, tags?: { [key: string]: string } | string[]) {


    if (SFPStatsSender.client != null)
      SFPStatsSender.client.timing(metric, elapsedMilliSeconds, tags);


    let metrics = {
      metric: `sfpowerscripts.${metric}`,
      type: `timers`,
      value: elapsedMilliSeconds,
      timestamp:Date.now(),
      tags: tags
    }
    SFPStatsSender.logMetrics(metrics,SFPStatsSender.metricsLogger);
  }

  static logGauge(metric: string, value: number, tags?: { [key: string]: string } | string[]) {


    if (SFPStatsSender.client != null)
      SFPStatsSender.client.gauge(metric, value, tags);


    let metrics = {
      metric: `sfpowerscripts.${metric}`,
      type: `guage`,
      value: value,
      timestamp:Date.now(),
      tags: tags
    }
    SFPStatsSender.logMetrics(metrics,SFPStatsSender.metricsLogger);
  }

  static logCount(metric: string, tags?: { [key: string]: string } | string[]) {

    if (SFPStatsSender.client != null)
      SFPStatsSender.client.increment(metric, tags)

    let metrics = {
      metric: `sfpowerscripts.${metric}`,
      type: `count`,
      timestamp:Date.now(),
      tags: tags
    }
    SFPStatsSender.logMetrics(metrics,SFPStatsSender.metricsLogger);
  }



  static logMetrics(key: any, logger?:any) {
    if (logger) {
      fs.appendFileSync(logger, `${JSON.stringify(key)}${EOL}`, 'utf8')
    }
  }
}
