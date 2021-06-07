import * as fs from "fs-extra";
import { EOL } from "os";
import chalk = require("chalk");

export enum LoggerLevel {
  TRACE = 10,
  DEBUG = 20,
  INFO = 30,
  WARN = 40,
  ERROR = 50,
  FATAL = 60,
}

const enum LoggerType
{
  console=1,
  file=2,
  void=3
}
export class ConsoleLogger implements Logger  {public logType:LoggerType; constructor(){this.logType=LoggerType.console;} }
export class VoidLogger  implements Logger  {public logType:LoggerType;  constructor(){this.logType=LoggerType.void;} }
export class FileLogger implements Logger { public logType:LoggerType; constructor(public path:string){ this.logType=LoggerType.file;} };     
export interface Logger { logType:LoggerType; path?:string}

const error = chalk.bold.red;
const warning = chalk.keyword("orange");
const info = chalk.green;
const trace = chalk.blue;
const debug = chalk.gray;

export default class SFPLogger {
  public static logLevel: LoggerLevel = LoggerLevel.INFO;

  static log(
    message: string,
    logLevel = LoggerLevel.INFO,
    logger?:Logger
  ) {
    if (logLevel == null) logLevel = LoggerLevel.INFO;

    if(logLevel < this.logLevel) return;

    if (logger) {
      if (logger.logType===LoggerType.void) {
        return;
      } else if (logger.logType===LoggerType.file) {
        let fileLogger = logger as FileLogger;
        fs.appendFileSync(fileLogger.path, message + EOL, "utf8");
      }
    } else {
      switch (logLevel) {
        
        case LoggerLevel.TRACE:
          console.log(trace(message));
          break;

        case LoggerLevel.DEBUG:
          console.log(debug(message));
          break;

        case LoggerLevel.INFO:
          console.log(info(message));
          break;

        case LoggerLevel.WARN:
          console.log(warning(message));
          break;

        case LoggerLevel.ERROR:
          console.log(error(message));
          break;

        case LoggerLevel.ERROR:
          console.log(error(message));
          break;
      }
    }
  }
}
