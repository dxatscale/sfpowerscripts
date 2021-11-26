const Table = require("cli-table");
import DependencyViolation from "../dependency/DependencyViolation";
import SFPLogger from "../logger/SFPLogger";

export default class DependencyViolationDisplayer {

  public static printDependencyViolations(dependencyViolations: DependencyViolation[]) {

    if (!dependencyViolations || dependencyViolations.length === 0) return;

    const table = new Table({
      head: ["API Name", "Type", "Package", "Dependency", "Dependency Type", "Dependency Package", "Problem"],
    });

    SFPLogger.log(
      "The following components resulted in failures:"
    );

    dependencyViolations.forEach(violation => {
      table.push([violation.component.fullName, violation.component.type, violation.component.package, violation.dependency.fullName, violation.dependency.type, violation.dependency.package, violation.description]);
    })

    SFPLogger.log(table.toString());
  }
}
