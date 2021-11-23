const Table = require("cli-table");
import DependencyViolation from "../dependency/DependencyViolation";
import SFPLogger, { Logger, LoggerLevel } from "../logger/SFPLogger";

export default class DependencyViolationDisplayer {

  public static printDependencyViolations(dependencyViolations: DependencyViolation[]) {

    if (!dependencyViolations || dependencyViolations.length === 0) return;

    const table = new Table({
      head: ["API Name", "Type", "Package", "Files", "Problem"],
    });

    SFPLogger.log(
      "The following components resulted in failures:"
    );

    dependencyViolations.forEach(violation => {
      table.push([violation.fullName, violation.type, violation.package, violation.files.toString(), violation.description]);
    })

    SFPLogger.log(table.toString());
  }
}
