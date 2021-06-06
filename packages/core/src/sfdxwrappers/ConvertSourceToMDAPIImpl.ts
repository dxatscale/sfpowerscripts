import path from "path";
import { SFDXCommand } from "../SFDXCommand";
import SFPLogger, { LoggerLevel } from "../logger/SFPLogger";

export default class ConvertSourceToMDAPIImpl extends SFDXCommand {

  private sourceDirectory:string;
  private mdapiDir:string;


  public constructor(
    project_directory:string,
    sourceDirectory: string,
    packageLogger?: any,
    logLevel?: LoggerLevel
  ) {
    super(null, project_directory, packageLogger, logLevel);
    this.sourceDirectory=sourceDirectory;
  }

  public async exec(quiet?: boolean): Promise<any> {

    try
    {
    await super.exec(quiet);
    let mdapiDirPath;
      if (this.project_directory != null)
           mdapiDirPath = path.resolve(this.project_directory, this.mdapiDir);
      else 
       mdapiDirPath = path.resolve(this.mdapiDir);
      SFPLogger.log(
        `Converting to MDAPI  Format Completed at ${mdapiDirPath}`,
        LoggerLevel.INFO
      );
      return mdapiDirPath
      }
      catch (error) {
        SFPLogger.log(
          `Unable to convert source for directory ${this.sourceDirectory}`
        );
        throw error;
      }

  }
  getCommandName(): string {
    return "ConvertSourceToMDAPI";
  }


  getGeneratedSFDXCommandWithParams(): string {
    try {
      this.mdapiDir = `.sfpowerscripts/${this.makefolderid(5)}_mdapi`;

      if (this.project_directory != null)
        SFPLogger.log(
          `Converting to MDAPI Format ${this.sourceDirectory} in project directory ${this.project_directory}`
        );
      else
        SFPLogger.log(
          `Converting to MDAPI Format ${this.sourceDirectory} in project directory`
        );

      return `sfdx force:source:convert -r ${this.sourceDirectory}  -d ${this.mdapiDir}`;
    } catch (error) {
      SFPLogger.log(
        `Unable to generate command for converting ${this.sourceDirectory}`,
        LoggerLevel.ERROR
      );
      throw error;
    }
  }

  private makefolderid(length): string {
    var result = "";
    var characters =
      "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
    var charactersLength = characters.length;
    for (var i = 0; i < length; i++) {
      result += characters.charAt(Math.floor(Math.random() * charactersLength));
    }
    return result;
  }
}
