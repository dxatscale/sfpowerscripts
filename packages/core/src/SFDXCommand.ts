

import ExecuteCommand from "./commandExecutor/ExecuteCommand";
import { LoggerLevel } from "./logger/SFPLogger";

export abstract class SFDXCommand {
  public constructor(
    protected target_org: string,
    protected project_directory: string,
    protected logFile?: any,
    protected loggerLevel?: LoggerLevel
  ) {}

  public exec(quiet = true): Promise<any> {

    return new ExecuteCommand().execCommand(this.getGeneratedSFDXCommandWithParams(),this.project_directory);
  }

  abstract getCommandName(): string;
  abstract getGeneratedSFDXCommandWithParams(): string;
}


