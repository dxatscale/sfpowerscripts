import child_process = require("child_process");
let fs = require("fs-extra");
let path = require("path");
import { isNullOrUndefined } from "util";
const xmlParser = require("xml2js").Parser({ explicitArray: false });
export type MDAPIPackageArtifact = {
  mdapiDir: string;
};
import {
  readdirSync,
  readFileSync,
  existsSync
} from "fs";
import ignore from "ignore";
import Logger from "../utils/Logger";

export default class MDAPIPackageGenerator {
  public static async getMDAPIPackageFromSourceDirectory(
    projectDirectory: string,
    sourceDirectory?: string
  ): Promise<{
    mdapiDir: string;
    manifest;
  }> {
    const mdapiPackage: { mdapiDir: string; manifest } = {
      mdapiDir: "",
      manifest: {},
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

    mdapiPackage.manifest = await this.xml2json(packageXml);
    return mdapiPackage;
  }

  private static convertSourceToMDAPI(projectDir, sourceDirectory): string {
    try {
      let mdapiDir: string = `${this.makefolderid(5)}_mdapi`;

      if (!isNullOrUndefined(projectDir))
        Logger.log(
          `Converting to MDAPI Format ${sourceDirectory} in project directory ${projectDir}`
        );
      else
        Logger.log(
          `Converting to MDAPI Format ${sourceDirectory} in project directory`
        );
      child_process.execSync(
        `npx sfdx force:source:convert -r ${sourceDirectory}  -d ${mdapiDir}`,
        { cwd: projectDir, encoding: "utf8" }
      );

      let mdapiDirPath;
      if (!isNullOrUndefined(projectDir))
        mdapiDirPath = path.resolve(projectDir, mdapiDir);
      else mdapiDirPath = path.resolve(mdapiDir);
      Logger.log(`Converting to MDAPI  Format Completed at ${mdapiDirPath}`);
      return mdapiDirPath;
    } catch (error) {
      Logger.log(`Unable to convert source for directory ${sourceDirectory}`);
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


  public static isToBreakBuildForEmptyDirectory(
    projectDir: string,
    sourceDirectory: string,
    isToBreakBuildIfEmpty: boolean
  ): {
    message: string;
    result: string;
  } {
    let directoryToCheck;
    let status: { message: string; result: string } = {
      message: "",
      result: "",
    };

    if (!isNullOrUndefined(projectDir)) {
      directoryToCheck = path.join(projectDir, sourceDirectory);
    } else directoryToCheck = sourceDirectory;

    try {
      if (!existsSync(directoryToCheck)) {
        //Folder do not exists, break build
        if (isToBreakBuildIfEmpty) {
          status.message = `Folder not Found , Stopping build as isToBreakBuildIfEmpty is ${isToBreakBuildIfEmpty}`;
          status.result = "break";
        } else {
          status.message = `Folder not Found , Skipping task as isToBreakBuildIfEmpty is ${isToBreakBuildIfEmpty}`;
          status.result = "skip";
        }
        return status;
      } else if (
        MDAPIPackageGenerator.isEmptyFolder(projectDir, sourceDirectory)
      ) {
        if (isToBreakBuildIfEmpty) {
          status.message = `Folder is Empty , Stopping build as isToBreakBuildIfEmpty is ${isToBreakBuildIfEmpty}`;
          status.result = "break";
        } else {
          status.message = `Folder is Empty, Skipping task as isToBreakBuildIfEmpty is ${isToBreakBuildIfEmpty}`;
          status.result = "skip";
        }
        return status;
      } else {
        status.result = "continue";
        return status;
      }
    } catch (err) {
      if (err.code === "ENOENT") {
        throw new Error(`No such file or directory ${err.path}`); // Re-throw error if .forceignore does not exist
      } else if (!isToBreakBuildIfEmpty) {
        status.message = `Something wrong with the path provided  ${directoryToCheck},,but skipping `;
        status.result = "skip";
        return status;
      } else throw err;
    }
  }


  public static isEmptyFolder(
    projectDirectory: string,
    sourceDirectory: string
  ): boolean {
    let dirToCheck;

    if (!isNullOrUndefined(projectDirectory)) {
      dirToCheck = path.join(projectDirectory, sourceDirectory);
    } else {
      dirToCheck = sourceDirectory;
    }

    let files: string[] = readdirSync(dirToCheck);

    // Construct file paths that are relative to the project directory.
    files.forEach((file, index, files) => {
      let filepath = path.join(dirToCheck, file);
      files[index] = path.relative(process.cwd(), filepath);
    });

    let forceignorePath;
    if (!isNullOrUndefined(projectDirectory))
      forceignorePath = path.join(projectDirectory, ".forceignore");
    else forceignorePath = path.join(process.cwd(), ".forceignore");

    // Ignore files that are listed in .forceignore
    files = ignore()
      .add(readFileSync(forceignorePath).toString()) // Add ignore patterns from '.forceignore'.
      .filter(files);

    if (files == null || files.length === 0) return true;
    else return false;
  }
}
