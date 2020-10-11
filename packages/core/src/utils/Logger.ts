export default class Logger {
  public static isSupressLogs = false;

  static log(key: any, value?: any) {
    if (!this.isSupressLogs) {
      if (value) console.log(key, value);
      else console.log(key);
    }
  }
}
