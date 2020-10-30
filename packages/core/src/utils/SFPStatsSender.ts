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
      prefix:"sfpowerscripts"
    };
    SFPStatsSender.client = new StatsDClient(options);
  }

   static logElapsedTime(metric: string, elapsedMilliSeconds: number,tags?:string[]) {
    if (SFPStatsSender.client != null)
        SFPStatsSender.client.timing(metric, elapsedMilliSeconds,tags);
  }

   static logGuage(metric: string, value: number,tags?:string[]) {
    if (SFPStatsSender.client != null)
      SFPStatsSender.client.gauge(metric, value,tags);
  }
}
