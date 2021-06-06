const Table = require("cli-table");
import SFPLogger from "../logger/SFPLogger";

export default class DeployErrorDisplayer {

  public static printMetadataFailedToDeploy(componentFailures: any, packageLogger?: any) {

    if (componentFailures === null || componentFailures === undefined) return;

    let table = new Table({
      head: ["Metadata Type", "API Name","Problem Type","Problem"],
    });

    let pushComponentFailureIntoTable = (componentFailure) => {
        let item = [
          componentFailure.componentType,
          componentFailure.fullName,
          componentFailure.problemType,
          componentFailure.problem
        ];
        table.push(item);
    };

    if (componentFailures instanceof Array) {
      for (let failure of componentFailures) {
        pushComponentFailureIntoTable(failure);
      }
    } else {
      let failure = componentFailures;
      pushComponentFailureIntoTable(failure);
    }
    SFPLogger.log(
      "The following components resulted in failures:",
      packageLogger
    );
    SFPLogger.log(table.toString(), packageLogger);
  }
}
