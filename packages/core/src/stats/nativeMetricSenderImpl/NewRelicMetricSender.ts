
import { NativeMetricSender } from "../NativeMetricSender";
import { telemetry } from '@newrelic/telemetry-sdk'
import { CountMetric, GaugeMetric, MetricBatch, MetricClient } from "@newrelic/telemetry-sdk/dist/src/telemetry/metrics";
import SFPLogger, { Logger, LoggerLevel } from "../../logger/SFPLogger";





export class NewRelicMetricSender extends NativeMetricSender
{



  constructor(logger:Logger)
  {
    super(logger);
  }

  
  private  nrMetricClient: telemetry.metrics.MetricClient;


  //Ignore API Host, as newrelic sdk doesnt need it
  public initialize(apiHost: string, apiKey: string) {
    try {
      this.nrMetricClient = new MetricClient({apiKey:apiKey});
    } catch (error) {
      SFPLogger.log(`Unable to intialize native newrelic metric logger ${error}`,LoggerLevel.WARN, this.logger);
    }
  }
  
  public sendGaugeMetric(
    metric: string,
    value: number,
    tags: string[] | { [key: string]: string }
  ) {
   
      metric= `sfpowerscripts.${metric}`
      const guageMetric = new GaugeMetric(metric, value );
      guageMetric.attributes = tags as { [key: string]: string };
      const batch = new MetricBatch(
        {},              
        Date.now(),      
        1            
      )
      batch.addMetric(guageMetric);
      this.nrMetricClient.send(
        batch,(error,response,body)=>{ 
          if(response)
          {
          SFPLogger.log(`Transmitted metric ${metric} ${response.statusCode}`,LoggerLevel.TRACE,this.logger);
          }
          if(error)
           SFPLogger.log(`Unable to transmit metrics for metric ${metric} due to`+error,LoggerLevel.WARN,this.logger);
        }
      );
  }


  public sendCountMetric(
    metric: string,
    tags: string[] | { [key: string]: string }
  ) {
    metric= `sfpowerscripts.${metric}`
    const countMetric = new CountMetric(metric);
    countMetric.record(1);
    countMetric.attributes = tags as { [key: string]: string };
    const batch = new MetricBatch(
      {},              
      Date.now(),      
      1            
    )
    batch.addMetric(countMetric);

    this.nrMetricClient.send(
      batch,(error,response,body)=>{ 
        if(response){
         SFPLogger.log(`Transmitted metric ${metric} ${response.statusCode}`,LoggerLevel.TRACE,this.logger);
        }
        if(error)
         SFPLogger.log(`Unable to transmit metrics for metric ${metric} due to`+error,LoggerLevel.WARN,this.logger);
      }
    );
  }

 

}