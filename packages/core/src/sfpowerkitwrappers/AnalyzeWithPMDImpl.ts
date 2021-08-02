import { SFDXCommand } from "../command/SFDXCommand";
import SFPLogger, { Logger, LoggerLevel } from "../logger/SFPLogger";

export default class AnalyzeWithPMDImpl extends SFDXCommand {
  public constructor(
    protected project_directory: string,
    private directory: string,
    private ruleset: string,
    private format: string,
    private ouputPath: string,
    private version: string,
    protected logger?: Logger,
    protected logLevel?: LoggerLevel
  ) {
    super(null, project_directory,logger,logLevel);
  }

  getSFDXCommand(): string {
    return "sfdx sfpowerkit:source:pmd";
  }
  getCommandName(): string {
    return "PMD Analysis";
  }
  getGeneratedParams(): string {
    let command:string="";


    if (this.directory) command=`-d  ${this.directory}`;
    if (this.format)    command +=` -f  ${this.format}`;
    if (this.ouputPath) command+=` -o  ${this.ouputPath}`;
    if (this.version)   command+=` --version  ${this.version}`;
    command +=` --loglevel ${LoggerLevel[SFPLogger.logLevel]}`;
    
    
    return command;
  }
}
