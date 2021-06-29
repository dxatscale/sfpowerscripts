import StatsDClient, { ClientOptions, StatsD } from "hot-shots";
import * as fs from "fs-extra";
import { EOL } from "os";
import { BufferedMetricsLogger } from "datadog-metrics";

export default class SFPStatsSender {
  private static client: StatsD;
  private static metricsLogger;
  private static nativeDataDogMetricsLogger: BufferedMetricsLogger;

  static initialize(port: string, host: string, protocol: string) {
    let options: ClientOptions = {
      host: host,
      port: port == null ? 8125 : Number(port),
      protocol: protocol == "tcp" ? "tcp" : "udp",
      prefix: "sfpowerscripts."
    };
    SFPStatsSender.client = new StatsDClient(options);
  }

  static initializeLogBasedMetrics() {
    try {
      fs.mkdirpSync(".sfpowerscripts/logs");
      SFPStatsSender.metricsLogger = `.sfpowerscripts/logs/metrics.log`;
    } catch (error) {
      console.log("Unable to initiate Log based metrics", error);
    }
  }

  static initializeNativeDataDogMetrics(apiHost: string, apiKey: string) {
    try {
      SFPStatsSender.nativeDataDogMetricsLogger = new BufferedMetricsLogger({
        apiHost: apiHost,
        apiKey: apiKey,
        prefix: "sfpowerscripts.",
        flushIntervalSeconds: 0,
      });
    } catch (error) {
      console.log("Unable to intialize native datadog logger", error);
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
    if (SFPStatsSender.nativeDataDogMetricsLogger != null) {
      SFPStatsSender.sendDataDogGaugeMetric(metric, elapsedMilliSeconds, tags);
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

    //Native Datadog integration
    if (SFPStatsSender.nativeDataDogMetricsLogger != null) {
      SFPStatsSender.sendDataDogGaugeMetric(metric, value, tags);
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

    //Native Datadog integration
    if (SFPStatsSender.nativeDataDogMetricsLogger != null) {
      SFPStatsSender.sendDataDogCountMetric(metric, tags);
    }

    let metrics = {
      metric: `sfpowerscripts.${metric}`,
      type: `count`,
      timestamp: Date.now(),
      tags: tags,
    };
    SFPStatsSender.logMetrics(metrics, SFPStatsSender.metricsLogger);
  }

  private static sendDataDogGaugeMetric(
    metric: string,
    value: number,
    tags: string[] | { [key: string]: string }
  ) {
    try {
      let transformedTags = SFPStatsSender.transformTagsToStringArray(tags);
      SFPStatsSender.nativeDataDogMetricsLogger.gauge(
        metric,
        value,
        transformedTags
      );
      SFPStatsSender.nativeDataDogMetricsLogger.flush();
    } catch (error) {
      console.log("Unable to transmit metrics for metric", metric);
    }
  }


  private static sendDataDogCountMetric(
    metric: string,
    tags: string[] | { [key: string]: string }
  ) {
    try {
      let transformedTags = SFPStatsSender.transformTagsToStringArray(tags);
      SFPStatsSender.nativeDataDogMetricsLogger.increment(
        metric,
        1,
        transformedTags
      );
      SFPStatsSender.nativeDataDogMetricsLogger.flush();
    } catch (error) {
      console.log("Unable to transmit metrics for metric", metric);
    }
  }

  static logMetrics(key: any, logger?: any) {
    if (logger) {
      fs.appendFileSync(logger, `${JSON.stringify(key)}${EOL}`, "utf8");
    }
  }

  private static transformTagsToStringArray(
    tags: { [key: string]: string } | string[]
  ): string[] {
    if (tags != null && !Array.isArray(tags)) {
      let transformedTagArray: string[] = new Array();
      for (const [key, value] of Object.entries(tags)) {
        transformedTagArray.push(`${key}:${value}`);
      }
      return transformedTagArray;
    }
    return tags as string[];
  }
}
