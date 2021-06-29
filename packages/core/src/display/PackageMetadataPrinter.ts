const Table = require("cli-table");
import SFPLogger, { Logger, LoggerLevel } from "../logger/SFPLogger";

export default class PackageMetadataPrinter {
  public static printMetadataToDeploy(payload: any, logger: Logger) {
    //If Manifest is null, just return
    if (payload === null || payload === undefined) return;

    let table = new Table({
      head: ["Metadata Type", "API Name"],
    });

    let pushTypeMembersIntoTable = (type) => {
      if (type["members"] instanceof Array) {
        for (let member of type["members"]) {
          let item = [type.name, member];
          table.push(item);
        }
      } else {
        let item = [type.name, type.members];
        table.push(item);
      }
    };

    if (payload["Package"]["types"] instanceof Array) {
      for (let type of payload["Package"]["types"]) {
        pushTypeMembersIntoTable(type);
      }
    } else {
      let type = payload["Package"]["types"];
      pushTypeMembersIntoTable(type);
    }
    SFPLogger.log(
      "The following metadata will be deployed:",
      LoggerLevel.INFO,logger
    );
    SFPLogger.log(table.toString(),LoggerLevel.INFO,logger);
  }



}
