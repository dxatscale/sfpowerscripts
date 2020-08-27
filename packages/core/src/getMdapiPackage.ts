import child_process = require("child_process");
let fs = require("fs-extra");
let path = require("path");
import { isNullOrUndefined } from "util";
const xmlParser = require("xml2js").Parser({ explicitArray: false });

export default async function getMDAPIPackageFromSourceDirectory(
    projectDirectory,
    sourceDirectory): Promise<{
        mdapiDir: string,
        manifestAsJSON
    }> {
    const mdapiPackage: {mdapiDir: string, manifestAsJSON} = {
        mdapiDir: "",
        manifestAsJSON: {}
    };

    let mdapiDir: string = convertSourceToMDAPI(projectDirectory, sourceDirectory);
    mdapiPackage["mdapiDir"] = mdapiDir;

    let packageXml: string = fs.readFileSync(
        path.join(mdapiDir, "package.xml"),
        "utf8"
    );

    mdapiPackage["manifestAsJSON"] = await xml2json(packageXml);
    return mdapiPackage;
}

function convertSourceToMDAPI(projectDir, sourceDirectory): string {
    try {
        let mdapiDir: string = `${makefolderid(5)}_mdapi`;

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


        let outputDir: string;
        if (!isNullOrUndefined(projectDir)) {
            outputDir = path.resolve(
                projectDir,
                mdapiDir
            );
        } else {
            outputDir = mdapiDir;
        }
        return outputDir;
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

async function xml2json(xml) {
    return new Promise( (resolve, reject) => {
        xmlParser.parseString(xml, function (err, json) {
            if (err)
                reject(err);
            else
                resolve(json);
        });
    });
}
