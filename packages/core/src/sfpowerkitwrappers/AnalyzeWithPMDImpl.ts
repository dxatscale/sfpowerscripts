import { SFDXCommand } from "../command/SFDXCommand";
import SFPLogger, { Logger, LoggerLevel } from "../logger/SFPLogger";

export default class AnalyzeWithPMDImpl extends SFDXCommand {
  public constructor(
    protected sourceDirectory: string,
    private ruleset: string, //Future Use
    private minimumpriority: string,
    private format: string,
    private ouputPath: string,
    private version: string,
    protected logger?: Logger,
    protected logLevel?: LoggerLevel
  ) {
    super(null, null,logger,logLevel);
  }

  getSFDXCommand(): string {
    return "sfdx sfpowerkit:source:pmd";
  }
  getCommandName(): string {
    return "PMD Analysis";
  }
  getGeneratedParams(): string {
    let command:string="";


    if (this.sourceDirectory) command=`-d  ${this.sourceDirectory}`;
    if (this.minimumpriority) command = `--minimumpriority  ${this.minimumpriority}`;
    if (this.format)    command +=` -f  ${this.format}`;
    if (this.ouputPath) command+=` -o  ${this.ouputPath}`;
    if (this.version)   command+=` --version  ${this.version}`;
    command+=` --no-failonviolation`
    command +=` --loglevel ${LoggerLevel[SFPLogger.logLevel]}`;
    
    
    return command;
  }
}
