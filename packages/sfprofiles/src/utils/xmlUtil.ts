import * as xml2js from 'xml2js';
import * as util from 'util';
import * as fs from 'fs-extra';
import * as path from 'path';
import { AnyJson } from '@salesforce/ts-types';
import Profile from '@impl/metadata/schema';

export default class XmlUtil {
    public static async xmlToJSON(directory: string) {
        const parser = new xml2js.Parser({ explicitArray: false });
        const parseString = util.promisify(parser.parseString) as _.Function1<xml2js.convertableToString, Promise<{ Profile: Profile }>>;
        let obj = await parseString(fs.readFileSync(path.resolve(directory)));
        return obj;
    }
    public static jSONToXML(obj: AnyJson) {
        const builder = new xml2js.Builder();
        let xml = builder.buildObject(obj);
        return xml;
    }
}
