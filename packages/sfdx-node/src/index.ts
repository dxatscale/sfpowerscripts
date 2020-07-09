import * as path from 'path';
import {registerNamespace} from './parallel';

const ALM_PATH = path.dirname(require.resolve('salesforce-alm'));


registerNamespace({
    commandsDir: path.join(ALM_PATH, 'commands'),
    namespace: 'force'
});




export {sfdx, registerNamespace} from './parallel';
export * from './types';
