import axios, { AxiosInstance } from 'axios';
import { Subject } from 'rxjs';
import SFPLogger, { LoggerLevel, COLOR_TRACE } from '@dxatscale/sfp-logger';
import dotenv from 'dotenv';

dotenv.config();

if(process.env.EVENT_STREAM_NODE_TLS_REJECT_UNAUTHORIZED){
    process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
}

export class HookService<T> {
  private static instance: HookService<any>;
  private axiosInstance: AxiosInstance;
  private logSubject: Subject<T>;

  private constructor() {
    this.axiosInstance = axios.create();
    if(process.env.EVENT_STREAM_WEBHOOK_TOKEN){
      this.axiosInstance.defaults.headers.common['Authorization'] = process.env.EVENT_STREAM_WEBHOOK_TOKEN;
    }
    this.logSubject = new Subject<T>();
    this.logSubject.subscribe((event) => this.sendLogEvent(event));
  }

  public static getInstance(): HookService<any> {
    if (!HookService.instance) {
        HookService.instance = new HookService();
    }
    return HookService.instance;
  }

  public logEvent(event: T) {
    this.logSubject.next(event);
  }

  private sendLogEvent(event: T) {
    const webhookUrl = process.env.EVENT_STREAM_WEBHOOK_URL; // Replace with your actual webhook URL

    this.axiosInstance.post(webhookUrl, event)
      .then(() => {
        SFPLogger.log(COLOR_TRACE(`Post Hook: ${JSON.stringify(event)}`), LoggerLevel.TRACE); 
      })
      .catch((error) => {
        SFPLogger.log(COLOR_TRACE(`Failed to fire hook: ${error}`), LoggerLevel.TRACE); 
        console.log('Hookie',error)
      });
  }
}

