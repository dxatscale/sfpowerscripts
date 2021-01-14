const Table = require("cli-table");
import SFPLogger from "../utils/SFPLogger";

export default class DeployErrorDisplayer {

  public static printMetadataFailedToDeploy(componentFailures: any, packageLogger?: any) {
    
    if (componentFailures === null || componentFailures === undefined) return;

    let table = new Table({
      head: ["Metadata Type", "API Name","Problem Type","Problem"],
    });

    let pushTypeMembersIntoTable = (type) => {
        let item = [type.componentType, type.fullName,type.problemType,type.problem];
        table.push(item);
    };

    if (componentFailures instanceof Array) {
      for (let type of componentFailures) {
        pushTypeMembersIntoTable(type);
      }
    } else {
      let type = componentFailures;
      pushTypeMembersIntoTable(type);
    }
    SFPLogger.log(
      "The following components resulted in failures:",
      null,
      packageLogger
    );
    SFPLogger.log(table.toString(), null, packageLogger);
  }
}