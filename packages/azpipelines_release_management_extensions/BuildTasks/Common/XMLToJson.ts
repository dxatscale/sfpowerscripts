import * as fs from 'fs';
import xml2js = require("xml2js");

export async function xml2json(xmlFilePath):Promise<any> {
    let xml: string = fs.readFileSync(
      xmlFilePath,
      "utf8"
  );
   let json = await xml2js.parseStringPromise(xml);
   return json
  }
  