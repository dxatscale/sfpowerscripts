import { Logger } from "../logger/SFPLogger";

export abstract class NativeMetricSender {
 
  constructor(protected logger:Logger)
  {
  }

  abstract initialize(apiHost: string, apiKey: string):void

  abstract  sendGaugeMetric(
    metric: string,
    value: number,
    tags: string[] | { [key: string]: string }
  ):void

  abstract sendCountMetric(
    metric: string,
    tags: string[] | { [key: string]: string }
  ):void

  protected  transformTagsToStringArray(
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