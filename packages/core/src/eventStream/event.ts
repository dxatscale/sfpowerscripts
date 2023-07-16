import { ReplaySubject } from 'rxjs';
import express, { Request, Response } from 'express';
import { Server } from 'http';
import SFPLogger, { LoggerLevel, COLOR_TRACE } from '@dxatscale/sfp-logger';


export class EventService<T> {
  private eventSubject: ReplaySubject<T>;
  private server: Server | undefined;
  private static instance: EventService<any>;

  public static getInstance(): EventService<any> {
    if (!this.instance) {
      this.instance = new EventService();
      this.instance.eventSubject = new ReplaySubject<any>();
    }
    this.instance.startStreaming();
    return this.instance;
  }

  logEvent(event: T) {
    this.eventSubject.next(event);
  }

  startStreaming() {
    if (!this.server) {
      const app = express();
      const port = process.env.EVENT_STREAM_PORT || 3000;

      app.get('/events', (req: Request, res: Response) => {
        res.setHeader('Content-Type', 'text/event-stream');
        res.setHeader('Cache-Control', 'no-cache');
        res.setHeader('Connection', 'keep-alive');
        res.setHeader('Access-Control-Allow-Origin', '*');
        res.flushHeaders();

        this.eventSubject.subscribe((logEvent: T) => {
          SFPLogger.log(COLOR_TRACE(`Send Event: ${logEvent}`), LoggerLevel.TRACE);  
          res.write(`data: ${JSON.stringify(logEvent)}\n\n`);
        });
        
      });

      this.server = app.listen(port, () => {
        SFPLogger.log(COLOR_TRACE(`Event server listening at http://localhost:${port}`), LoggerLevel.TRACE);  
      });
    }
  }

  closeServer() {
    if (this.server) {
      this.eventSubject.complete(); // Complete the eventSubject when closing the server
      this.server.close(() => {
        SFPLogger.log(COLOR_TRACE(`Server closed.`), LoggerLevel.TRACE); 
      });
      this.server = undefined;
    } else {
      SFPLogger.log(COLOR_TRACE(`Server is not running.`), LoggerLevel.TRACE); 
    }
  }
}

