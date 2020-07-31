import child_process = require("child_process");
let fs = require("fs-extra");
let path = require("path");
import { isNullOrUndefined, promisify } from "util";
const xml2js = require("xml2js");

export default async function getPackageManifest(projectDirectory, sourceDirectory) {
    let mdapiDir: string = `${makefolderid(5)}_mdapi`;
    await convertSourceToMDAPI(projectDirectory, sourceDirectory, mdapiDir);

    let parser = new xml2js.Parser({ explicitArray: false });
    let parseString = promisify(parser.parseString);

    let packageXmlPath: string
    if (!isNullOrUndefined(projectDirectory)) {
        packageXmlPath = path.join(
        projectDirectory,
        mdapiDir,
        "package.xml"
        );
    } else {
        packageXmlPath = path.join(
        mdapiDir,
        "package.xml"
        );
    }

    let packageXml: string = fs.readFileSync(
        packageXmlPath,
        "utf8"
    );
    return await parseString(packageXml);
}

async function convertSourceToMDAPI(projectDir, sourceDirectory, mdapiDir): Promise<void> {
    try {
        if (!isNullOrUndefined(projectDir))
        console.log(
            `Converting to Source Format ${sourceDirectory} in project directory ${projectDir}`
        );
        else
        console.log(
            `Converting to Source Format ${sourceDirectory} in project directory`
        );
        child_process.execSync(
        `npx sfdx force:source:convert -r ${sourceDirectory}  -d ${mdapiDir}`,
        { cwd: projectDir, encoding: "utf8" }
        );
        console.log("Converting to Source Format Completed");
    } catch (error) {
        console.log("Unable to convert source, exiting " + error.code);
        throw error;
    }
}

function makefolderid(length): string {
    var result = "";
    var characters =
      "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
    var charactersLength = characters.length;
    for (var i = 0; i < length; i++) {
      result += characters.charAt(Math.floor(Math.random() * charactersLength));
    }
    return result;
  }
