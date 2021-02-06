import * as fs from "fs-extra";
import { EOL } from "os";

export enum LoggerLevel {
  TRACE = 10,
  DEBUG = 20,
  INFO = 30,
  WARN = 40,
  ERROR = 50,
  FATAL = 60
}

export default class SFPLogger {
  public static isSupressLogs = false;
  public static logLevel: LoggerLevel = LoggerLevel.DEBUG;

  static log(key: any, value?: any, logger?:any, logLevel: LoggerLevel = LoggerLevel.INFO) {
    if (logger) {
      if (value)
        try {
          fs.appendFileSync(logger, `${key}  :  ${JSON.stringify(value)} ${EOL}`, 'utf8')
        } catch (error) {
          fs.appendFileSync(logger, `${key}  :  ${value} ${EOL}`, 'utf8')
        }
      else
      fs.appendFileSync(logger, `${key}${EOL}`, 'utf8')
    }

    if (!SFPLogger.isSupressLogs && SFPLogger.logLevel <= logLevel) {
      if (value && (typeof jest == 'undefined'))  console.log(key, value);
      else 
       if(typeof jest == 'undefined') console.log(key);
    }
  }
}
