import child_process = require("child_process");
import SFPLogger, { Logger, LoggerLevel } from "../logger/SFPLogger";
import { onExit } from "../utils/OnExit";

export default class ReconcileProfileAgainstOrgImpl {
  public constructor(
    private target_org: string,
    private project_directory: string,
    private logger:Logger
  ) {}

  public async exec() {

    let command = this.buildExecCommand();
    let child = child_process.exec(
      command,
      { encoding: "utf8" ,cwd:this.project_directory}
    );

    child.stdout.on("data", data => {
      SFPLogger.log(data.toString(),LoggerLevel.INFO,this.logger);
    });
    child.stderr.on("data", data => {
      SFPLogger.log(data.toString(),LoggerLevel.INFO,this.logger);
    });

    await onExit(child);
  }

  private  buildExecCommand(): string {
    let command = `sfdx sfpowerkit:source:profile:reconcile  -u ${this.target_org}`;
    return command;
  }
}
