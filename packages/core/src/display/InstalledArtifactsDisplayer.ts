const Table = require("cli-table");
import SFPLogger, { Logger, LoggerLevel, COLOR_KEY_MESSAGE } from "../logger/SFPLogger";

export default class InstalledArtifactsDisplayer {

  public static printInstalledArtifacts(artifacts: any, logger: Logger) {

    if (artifacts == null) return;

    let table = new Table({
      head: ["Artifact", "Version", "Commit Id"],
    });

    artifacts.forEach((artifact) => {
      table.push([artifact.Name, artifact.Version__c, artifact.CommitId__c]);
    });

    SFPLogger.log(
      COLOR_KEY_MESSAGE("Artifacts installed in org:"),
      LoggerLevel.INFO,
      logger
    );
    SFPLogger.log(table.toString(), LoggerLevel.INFO, logger);



  }
}
