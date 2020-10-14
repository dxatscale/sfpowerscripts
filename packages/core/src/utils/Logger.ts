import log4js=require("log4js");

export default class Logger {
  public static isSupressLogs = false;

  static log(key: any, value?: any, logger?: log4js.Logger) {
    if (logger) {
      if (value)
        try {
          logger.debug(key + ":" + JSON.stringify(value));
        } catch (error) {
          logger.debug(key + ":" + value);
        }
      else logger.debug(key);
    }

    if (!this.isSupressLogs) {
      if (value) console.log(key, value);
      else console.log(key);
    }
  }
}
