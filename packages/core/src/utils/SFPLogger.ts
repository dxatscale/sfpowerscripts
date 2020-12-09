import * as fs from "fs-extra";
import { EOL } from "os";

export default class SFPLogger {
  public static isSupressLogs = false;
  public static logLevel: LoggerLevel;

  static log(key: any, value?: any, logger?:any, logLevel?: LoggerLevel) {
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

    if (
      !SFPLogger.isSupressLogs &&
      (logLevel == null || SFPLogger.logLevel == null || SFPLogger.logLevel <= logLevel)
    ) {
      if (value) console.log(key, value);
      else console.log(key);
    }
  }
}

export enum LoggerLevel {
  TRACE = 10,
  DEBUG = 20,
  INFO = 30,
  WARN = 40,
  ERROR = 50,
  FATAL = 60
}
