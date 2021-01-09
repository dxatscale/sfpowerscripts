import path from "path";
import * as fs from "fs-extra";
const xmlParser = require("xml2js").Parser({ explicitArray: false });


export default class PackageManifest
{

  public constructor(private mdapiDir:string){};
  
  public async getManifest() {
    let packageXml: string = fs.readFileSync(
      path.join(this.mdapiDir, "package.xml"),
      "utf8"
    );
    let manifest = await this.xml2json(packageXml);
    return manifest;
  }

  
  private xml2json(xml) {
    return new Promise((resolve, reject) => {
      xmlParser.parseString(xml, function (err, json) {
        if (err) reject(err);
        else resolve(json);
      });
    });
  }


  
}