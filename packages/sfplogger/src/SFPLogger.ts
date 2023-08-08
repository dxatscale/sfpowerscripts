import * as fs from 'fs-extra';
import { EOL } from 'os';
import chalk from 'chalk';
import stripAnsi = require('strip-ansi');


export enum LoggerLevel {
  TRACE = 10,
  DEBUG = 20,
  INFO = 30,
  WARN = 40,
  ERROR = 50,
  FATAL = 60,
  HIDE = 70,
}

const enum LoggerType {
  console = 1,
  file = 2,
  void = 3,
}
export class ConsoleLogger implements Logger {
  public logType: LoggerType;
  constructor() {
    this.logType = LoggerType.console;
  }
}
export class VoidLogger implements Logger {
  public logType: LoggerType;
  constructor() {
    this.logType = LoggerType.void;
  }
}
export class FileLogger implements Logger {
  public logType: LoggerType;
  constructor(public path: string) {
    this.logType = LoggerType.file;
  }
}
export interface Logger {
  logType: LoggerType;
  path?: string;
}

export const COLOR_ERROR = chalk.bold.red;
export const COLOR_WARNING = chalk.keyword('orange');
export const COLOR_INFO = chalk.white;
export const COLOR_TRACE = chalk.gray;
export const COLOR_DEBUG = chalk.blue;
export const COLOR_HEADER = chalk.yellowBright.bold;
export const COLOR_SUCCESS = chalk.green.bold;
export const COLOR_TIME = chalk.magentaBright;
export const COLOR_KEY_MESSAGE = chalk.magentaBright.bold;
export const COLOR_KEY_VALUE = chalk.black.bold.bgGreenBright;

export default class SFPLogger {
  public static logLevel: LoggerLevel = LoggerLevel.INFO;
  public static isLogsDisabled: boolean = false;

  static enableColor() {
    chalk.level = 2;
  }

  static disableColor() {
    chalk.level = 0;
  }

  static log(message: string, logLevel = LoggerLevel.INFO, logger?: Logger) {


    if (SFPLogger.isLogsDisabled) return;
    if (logLevel == null) logLevel = LoggerLevel.INFO;
  
    if (logLevel < this.logLevel) return;
  
    const maxLineLength = 100;
    const originalLines = message.split('\n');
    const lines = [];
  
    originalLines.forEach(line => {
      while (stripAnsi(line).length > maxLineLength) {
        let subLine = line.substring(0, maxLineLength);
        line = line.substring(maxLineLength);
        lines.push(subLine);
      }
      lines.push(line);
    });
  
    //Todo: Proper fix
    if (logger && logger.logType === LoggerType.console) {
      logger = null; // Make it nullable, so it goes to console
    }
  
    if (logger) {
      if (logger.logType === LoggerType.void) {
        return;
      } else if (logger.logType === LoggerType.file) {
        let fileLogger = logger as FileLogger;
        lines.forEach(line => {
          line = stripAnsi(line);
          fs.appendFileSync(fileLogger.path, line + EOL, 'utf8');
        });
      }
    } else {
      lines.forEach(line => {
        switch (logLevel) {
          case LoggerLevel.TRACE:
            console.log(COLOR_TRACE(line));
            break;
  
          case LoggerLevel.DEBUG:
            console.log(COLOR_DEBUG(line));
            break;
  
          case LoggerLevel.INFO:
            console.log(line);
            break;
  
          case LoggerLevel.WARN:
            console.log(COLOR_WARNING(line));
            break;
  
          case LoggerLevel.ERROR:
            console.log(COLOR_ERROR(line));
            break;
        }
      });
    }
  }

  static disableLogs() {
    SFPLogger.isLogsDisabled = true;
  }

  static printHeaderLine(header, color: chalk.Chalk, logLevel, logger?: Logger) {
    if (header == null)
      header = '';
    const lineLength = 90;
    const leftPadLength = Math.floor((lineLength - header.length) / 2);
    const rightPadLength = lineLength - leftPadLength - header.length;
    const line = '-'.repeat(leftPadLength) + `${header}` + '-'.repeat(rightPadLength);
    if (logger) {
      if (logger.logType === LoggerType.void) {
        return;
      } else if (logger.logType === LoggerType.file) {
        return;
      }
      else
        console.log(color(line));
    }
    else
      console.log(color(line));

  }
}
