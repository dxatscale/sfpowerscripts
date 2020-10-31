import StatsDClient, { ClientOptions, StatsD } from "hot-shots";


export default class SFPStatsSender {
  private static client: StatsD;

   static initialize(
    port: string,
    host: string,
    protocol: string
  ) {
    let options: ClientOptions = {
      host: host,
      port: port==null?8125:Number(port),
      protocol: protocol=="tcp"?"tcp":"udp",
      prefix:"sfpowerscripts."
    };
    SFPStatsSender.client = new StatsDClient(options);
  }

   static logElapsedTime(metric: string, elapsedMilliSeconds: number,tags?:{ [key: string]: string } | string[]) {
    if (SFPStatsSender.client != null)
        SFPStatsSender.client.timing(metric, elapsedMilliSeconds,tags);
  }

   static logGauge(metric: string, value: number,tags?:{ [key: string]: string } | string[]) {
    if (SFPStatsSender.client != null)
      SFPStatsSender.client.gauge(metric, value,tags);
  }

  static logCount(metric: string,tags?:{ [key: string]: string } | string[]) {
    if (SFPStatsSender.client != null)
      SFPStatsSender.client.increment(metric,tags)
  }
}
