import SFPLogger, { COLOR_HEADER, COLOR_KEY_MESSAGE, COLOR_SUCCESS } from "@dxatscale/sfp-logger";
import Component from "@dxatscale/sfpowerscripts.core/lib/dependency/Component";
import SFPOrg from "@dxatscale/sfpowerscripts.core/lib/org/SFPOrg";
import { LoggerLevel } from "@salesforce/core";
import GroupConsoleLogs from "../../ui/GroupConsoleLogs";
import { DeploymentResult } from "../deploy/DeployImpl";
import DependencyAnalysis from "@dxatscale/sfpowerscripts.core/lib/dependency/DependencyAnalysis";
import DependencyViolationDisplayer from "@dxatscale/sfpowerscripts.core/lib/display/DependencyViolationDisplayer";
import { Analyzer } from "./Analyzer";

export class DependencyAnalzer extends Analyzer {



  public constructor(baseBranch: string,
    private orgAsSFPOrg: SFPOrg,
    private deploymentResult: DeploymentResult,) {
    super(baseBranch)
  }

  public async dependencyAnalysis(
  ) {

    let groupSection = new GroupConsoleLogs(
      `Validate Dependency tree`,
    ).begin();
    SFPLogger.log(
      COLOR_HEADER(
        `-------------------------------------------------------------------------------------------`,
      ),
    );
    SFPLogger.log(
      COLOR_KEY_MESSAGE(
        "Validating dependency  tree of changed components..",
      ),
      LoggerLevel.INFO,
    );
    const changedComponents = await this.getChangedComponents();
    const dependencyAnalysis = new DependencyAnalysis(
      this.orgAsSFPOrg,
      changedComponents,
    );

    const dependencyViolations = await dependencyAnalysis.exec();

    if (dependencyViolations.length > 0) {
      DependencyViolationDisplayer.printDependencyViolations(
        dependencyViolations,
      );

      //TODO: Just Print for now, will throw errors once org dependent is identified
      // deploymentResult.error = `Dependency analysis failed due to ${JSON.stringify(dependencyViolations)}`;
      // throw new ValidateError(`Dependency Analysis Failed`, { deploymentResult });
    } else {
      SFPLogger.log(
        COLOR_SUCCESS("No Dependency violations found so far"),
        LoggerLevel.INFO,
      );
    }

    SFPLogger.log(
      COLOR_HEADER(
        `-------------------------------------------------------------------------------------------`,
      ),
    );
    groupSection.end();
    return dependencyViolations;

  }




}