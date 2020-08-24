import child_process = require("child_process");
let fs = require("fs-extra");
let path = require("path");
import { isNullOrUndefined } from "util";
const xmlParser = require("xml2js").Parser({ explicitArray: false });
export type MDAPIPackageArtifact = {
  mdapiDir: string;
};

export default class MDAPIPackageGenerator {




  public static async getMDAPIPackageFromSourceDirectory(
    projectDirectory:string,
    sourceDirectory?:string
  ): Promise<{
    mdapiDir: string;
    manifestAsJSON;
  }> {
    const mdapiPackage: { mdapiDir: string; manifestAsJSON } = {
      mdapiDir: "",
      manifestAsJSON: {},
    };

    let mdapiDir: string = this.convertSourceToMDAPI(
      projectDirectory,
      sourceDirectory
    );
    mdapiPackage["mdapiDir"] = mdapiDir;

    let packageXml: string = fs.readFileSync(
      path.join(mdapiDir, "package.xml"),
      "utf8"
    );

    mdapiPackage["manifestAsJSON"] = await this.xml2json(packageXml);
    return mdapiPackage;
  }

  private static convertSourceToMDAPI(projectDir, sourceDirectory): string {
    try {
      let mdapiDir: string = `${this.makefolderid(5)}_mdapi`;

      if (!isNullOrUndefined(projectDir))
        console.log(
          `Converting to MDAPI Format ${sourceDirectory} in project directory ${projectDir}`
        );
      else
        console.log(
          `Converting to MDAPI Format ${sourceDirectory} in project directory`
        );
      child_process.execSync(
        `npx sfdx force:source:convert -r ${sourceDirectory}  -d ${mdapiDir}`,
        { cwd: projectDir, encoding: "utf8" }
      );

      let mdapiDirPath;
      if (!isNullOrUndefined(projectDir))
         mdapiDirPath=path.resolve(projectDir,mdapiDir);
      else
         mdapiDirPath=path.resolve(mdapiDir);
      console.log(`Converting to MDAPI  Format Completed at ${mdapiDirPath}`);
      return mdapiDirPath;

    } catch (error) {
      console.log(`Unable to convert source for directory ${sourceDirectory}`);
      throw error;
    }
  }

  private static makefolderid(length): string {
    var result = "";
    var characters =
      "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
    var charactersLength = characters.length;
    for (var i = 0; i < length; i++) {
      result += characters.charAt(Math.floor(Math.random() * charactersLength));
    }
    return result;
  }

  private static xml2json(xml) {
    return new Promise((resolve, reject) => {
      xmlParser.parseString(xml, function (err, json) {
        if (err) reject(err);
        else resolve(json);
      });
    });
  }

  public static generateMDAPIPackageArtifact(
    projectDirectory: string,
    sfdxPackage: string,
    mdapiDir:string
  ):MDAPIPackageArtifact
  {
    let result = <MDAPIPackageArtifact>{};
   

    let artifactDirectory, individualFilePath;
    if (!isNullOrUndefined(projectDirectory)) {
      artifactDirectory = path.join(projectDirectory, "source_package");
      individualFilePath = projectDirectory;
    } else {
      artifactDirectory = "source_package";
      individualFilePath = "";
    }

    //Create a new directory
    fs.mkdirsSync(artifactDirectory);
    fs.copySync(
      mdapiDir,
      artifactDirectory
    );

    result.mdapiDir=artifactDirectory;
    return result;


  }

}
