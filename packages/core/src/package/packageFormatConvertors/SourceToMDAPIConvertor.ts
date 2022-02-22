import {
  ComponentSet,
  MetadataConverter,
} from "@salesforce/source-deploy-retrieve";
import path from "path";
import SFPLogger, { Logger, LoggerLevel } from "../../logger/SFPLogger";

export default class SourceToMDAPIConvertor {



  public constructor(
    private projectDirectory:string,
    private sourceDirectory: string,
    private logger?: Logger,
  ) {
   
  }

  public async convert() {
    let mdapiDir=`.sfpowerscripts/${this.makefolderid(5)}_mdapi`;;
    //Create destination directory
    if (this.projectDirectory != null)
      mdapiDir = path.resolve(this.projectDirectory, mdapiDir);


    //Build component set from provided source directory
    let componentSet = ComponentSet.fromSource({
      fsPaths: [this.sourceDirectory],
    });

    const converter = new MetadataConverter();
    let convertResult = await converter.convert(componentSet, "metadata", {
      type: "directory",
      outputDirectory: mdapiDir,
    });
    SFPLogger.log(`Source converted successfully to ${mdapiDir}`,LoggerLevel.INFO,this.logger);
    SFPLogger.log(`ConvertResult:`+JSON.stringify(convertResult),LoggerLevel.TRACE,this.logger);

    return convertResult;
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
