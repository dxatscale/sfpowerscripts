import * as path from 'path';
import {registerNamespace} from './parallel';
import child_process = require("child_process");


let YARN_GLOBAL_PATH="";
let NPM_GLOBAL_PATH="";

try { YARN_GLOBAL_PATH = child_process.execSync("yarn global dir").toString(); } catch(error) { YARN_GLOBAL_PATH="";}
try { NPM_GLOBAL_PATH = child_process.execSync("npm root -g").toString(); } catch( error){ NPM_GLOBAL_PATH="";}


const ALM_PATH = path.dirname(require.resolve('salesforce-alm',{paths:
    [
         path.join(process.env.LOCALAPPDATA,"/sfdx/node_modules/salesforce-alm"),
         path.join(YARN_GLOBAL_PATH,"node_modules/salesforce-alm"),
         path.join(NPM_GLOBAL_PATH,"salesforce-alm")
    ]}));
console.log(ALM_PATH);


registerNamespace({
    commandsDir: path.join(ALM_PATH, 'commands'),
    namespace: 'force'
});


export {sfdx, registerNamespace} from './parallel';
export * from './types';
