import ExecuteCommand from "./commandExecutor/ExecuteCommand";
import { LoggerLevel } from "../logger/SFPLogger";

export abstract class SFDXCommand {
  public constructor(
    protected target_org: string,
    protected project_directory: string,
    protected logFile?: any,
    protected loggerLevel?: LoggerLevel
  ) {}

  public async exec(quiet = true): Promise<any> {
    let command = this.getSFDXCommand();
    if (quiet) command += ` --json`;
    command += " " + this.getGeneratedParams();

    let executor: ExecuteCommand = new ExecuteCommand();
    let output = await executor.execCommand(command, this.project_directory);
    if (quiet) {
      return JSON.parse(output).result;
    }
    return output;
  }

  public getGeneratedSFDXCommandWithParams()
  {
    let command = this.getSFDXCommand();
    command += " " + this.getGeneratedParams();
    return command;
  }

  abstract getSFDXCommand(): string;
  abstract getCommandName(): string;
  abstract getGeneratedParams(): string;
}
