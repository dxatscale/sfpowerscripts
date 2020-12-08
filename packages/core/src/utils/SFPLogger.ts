const fs = require("fs-extra");
import { EOL } from "os";

export default class SFPLogger {
  public static isSupressLogs = false;

  static log(key: any, value?: any, logger?:any) {
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


    if (!this.isSupressLogs) {
      if (value) console.log(key, value);
      else console.log(key);
    }
  }
}
