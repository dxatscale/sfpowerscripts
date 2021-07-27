import path from "path";
import { SFDXCommand } from "../command/SFDXCommand";
import { Logger, LoggerLevel } from "../logger/SFPLogger";

export default class VlocityPackUpdateSettings extends SFDXCommand
{

  public constructor(
    project_directory: string,
    target_org: string,
    private packageDirectory: string,
    logger: Logger,
    logLevel:LoggerLevel
  ) {
    super(target_org, project_directory,logger,logLevel);
  }


  getSFDXCommand(): string {
    return "vlocity"
  }
  getCommandName(): string {
    return "vlocity:packUpdateSettings"
  }
  
  getGeneratedParams(): string {
    let command = `-sfdx.username ${this.target_org} -job ${path.join(this.packageDirectory,"VlocityComponents.yaml")}  packUpdateSettings`;
    if(this.logLevel)
     command += ` --loglevel ${LoggerLevel[this.logLevel]}`;
    return command;
  }
}