const fs = require('fs');
const path = require('path');
const _ = require('lodash');
import child_process = require("child_process");



let YARN_GLOBAL_PATH;
let NPM_GLOBAL_PATH;

try { YARN_GLOBAL_PATH = child_process.execSync("yarn global dir").toString(); } catch(error) { YARN_GLOBAL_PATH="";}
try { NPM_GLOBAL_PATH = child_process.execSync("npm root -g").toString(); } catch( error){ NPM_GLOBAL_PATH="";}


const ALM_PATH = path.dirname(require.resolve('salesforce-alm',{paths:
    [
         path.join(process.env.LOCALAPPDATA,"/sfdx/node_modules/salesforce-alm"),
         path.join(YARN_GLOBAL_PATH,"node_modules/salesforce-alm"),
         path.join(NPM_GLOBAL_PATH,"salesforce-alm")
    ]}));
console.log(ALM_PATH);


const CMD_DIR = path.join(ALM_PATH, 'commands');
const ROOT_COMMAND = 'force';
const realStdoutWrite = process.stdout.write;
const realStderrWrite = process.stderr.write;
const cmdArray = [];
let sfdxErrors = [];
let hookCounter = 0;

// Catch errors thrown by Salesforce CLI commands
process.on('uncaughtException', errObj => {
  sfdxErrors.push(errObj);
});

/**
 * Restore the original stdout and stderr write methods.
*/
const unhookStd = () => {
  process.stdout.write = realStdoutWrite;
  process.stderr.write = realStderrWrite;
};

/**
 * Recursively step through a directory to find out all command files (.js). Pushes the file name and command key into an array.
 * @param {string} suffix Input directory name
 */
const processCommandsDir = (suffix) => {
  const cmdsDir = path.join(CMD_DIR, suffix);
  // Loop through the input directory
  fs.readdirSync(cmdsDir).forEach((fileOrDir) => {
    const cmdDefPath = path.join(cmdsDir, fileOrDir);
    if (fs.statSync(cmdDefPath).isDirectory()) {
      // If the current item is a directory, process the same
      processCommandsDir(path.join(suffix, fileOrDir));
    } else {
      // Except for the command files directly in the base command folder (force), push the file name and command key into the array
      if (suffix !== ROOT_COMMAND && path.extname(cmdDefPath) === '.js') {
        const obj = {};
        obj['commandFile'] = cmdDefPath;
        const fileNameWithoutExt = fileOrDir.replace('.js', '');
        obj['commandKey'] = path.join(suffix, fileNameWithoutExt);
        cmdArray.push(obj);
      }
    }
  });
};

/**
 * Method only returns true if input value is true, boolean or string (case-insensitive), e.g. true, True, TRUE.
 * Any other value is considered as falsy.
 * @param {*} inputValue Input value to convert to boolean
 */
const getBooleanValue = (inputValue) => {
  // Return as is, if input value is already boolean
  if (_.isBoolean(inputValue)) {
    return inputValue;
  }
  // Return true if the the input is a string 'true', in whatever case.
  if (typeof inputValue === 'string' && _.toLower(inputValue) === 'true') {
    return true;
  }
  return false;
};

/**
 * Takes input objects flags & opts, and converts them to argument array as accepted by Salesforce CLI commands
 * @param {Object} flags Command parameters
 * @param {Object} opts Special command arguments accepted by a few specific commands, such as force:alias:set
 */
const transformArgs = (flags:any = {}, opts:any = {}) => {
  const argsObj = {
    argv: [],
    quiet: true,
    rejectOnError: false,
  };
  _.forEach(flags, (flagValue, flagName) => {
    // convert all parameter names to lower case
    flagName = _.toLower(flagName);
    if (flagName === '_quiet') { // Determine if output needs to be suppressed
      argsObj.quiet = getBooleanValue(flagValue);
    } else if (flagName === '_rejectonerror') { // Determine if we need to reject in case the Salesforce CLI command fails
      argsObj.rejectOnError = getBooleanValue(flagValue);
    } else {
      // For parameters with boolean values, convert them to a single flag argument (without any value) and push into the args array
      if (_.isBoolean(flagValue)) {
        if (flagValue) {
          argsObj.argv.push(`--${flagName}`);
        }
      } else {
        // For parameters with non-boolean values, push parameter name and value as string into the args array
        argsObj.argv.push(`--${flagName}`, `${flagValue}`);
      }
    }
  });
  // If available, push the special commnand parameters into the args array
  if (opts && _.isArray(opts.args)) {
    argsObj.argv = _.concat(argsObj.argv, opts.args);
  }
  return argsObj;
};

/**
 * Creates a custom function for a command which accepts command parameters as function arguments. This custom
 * function actually executes the Salesforce CLI command.
 * @param {*} cmdId Command ID, e.g. force:alias:set
 * @param {*} cmdName Command Name as exported by the command module, e.g. AliasSetCommand
 * @param {*} cmdFile Command module file
 */
const _createCommand = (cmdId, cmdName, cmdFile) => (flags, opts) => new Promise((resolve, reject) => {
  const cmd = require(cmdFile)[cmdName];
  // cmd.strict = false;
  cmd.id = cmdId;
  const cmdArgs = transformArgs(flags, opts);
  let currentHookFlag = false;
  // If output needs to be suppressed, hook into the stdout and stderr streams and increase the counter
  if (cmdArgs.quiet) {
    const hookStd = require('hook-std');
    hookStd(() => { });
    hookCounter++;
    currentHookFlag = true;
  }
  // Empty error array before each SFDX call so that the logs from one command execution do not impact the subsequent commands
  sfdxErrors = [];
  cmd.run(cmdArgs.argv)
    .then((sfdxResult) => {
      // If output was suppressed, decrease the counter. If counter reaches zero, restore the original stdout and stderr streams.
      if (cmdArgs.quiet && currentHookFlag && hookCounter > 0) {
        hookCounter--;
        currentHookFlag = false;
        if (hookCounter === 0) {
          unhookStd();
        }
      }
      // In case there were any errors and rejection is required, throw the errors
      if (cmdArgs.rejectOnError && sfdxErrors.length) {
        throw sfdxErrors;
      }
      // Revert exitCode set by SFDX as we don't want CI scripts to exit due to this
      if (process.exitCode) {
        process.exitCode = 0;
      }
      resolve(sfdxResult);
    })
    .catch((sfdxErr) => {
      // If output was suppressed, decrease the counter. If counter reaches zero, restore the original stdout and stderr streams.
      if (cmdArgs.quiet && currentHookFlag && hookCounter > 0) {
        hookCounter--;
        currentHookFlag = false;
        if (hookCounter === 0) {
          unhookStd();
        }
      }
      // Revert exitCode set by SFDX as we don't want CI scripts to exit due to this
      if (process.exitCode) {
        process.exitCode = 0;
      }
      // Ensure that the error is thrown as an array of plain JS objects, in format => { message: "some error", stack: "stack trace for the error" }
      const errors = require('./process-errors');
      reject(errors.processAllErrors(sfdxErr));
    });
});

/**
 * Loops through all the commands and creates progrmmatically executable version of each Salesforce CLI command.
 */
const buildAllCommands = () => {
  // Populate the command array
  processCommandsDir(ROOT_COMMAND);
  // Loop through each command and create the function to execute a command
  _.forEach(cmdArray, (cmdObj) => {
    const { commandKey, commandFile } = cmdObj;
    const cmdKeyParts = commandKey.split(path.sep);
    let topic;
    const methodNamePartsArray = [];
    _.forEach(cmdKeyParts, (part, index) => {
      // Ignore first part, i.e. force
      if (index !== 0) {
        if (index === 1) {
          // Determine the command topic
          topic = part;
          if (!_.has(sfdxApi, part)) {
            sfdxApi[part] = {};
          }
        } else {
          // Collect all parts of the final method name in an array
          methodNamePartsArray.push(part);
        }
      }
    });
    // Actual exported method name
    const methodName = _.camelCase(methodNamePartsArray.join('-'));
    // Command ID, e.g. force:alias:set
    const commandId = cmdKeyParts.join(':');
    
    // Construct the command name as exported by each command module, e.g. AliasSetCommand
    const commandNamePartsArray = _.concat(topic, methodNamePartsArray, 'command');
    _.forEach(commandNamePartsArray, (value, index) => {
      commandNamePartsArray[index] = _.startCase(value);
    });
    const commandExportedName = commandNamePartsArray.join('');
    
    // Finally, create the custom method for this command
    sfdxApi[topic][methodName] = _createCommand(commandId, commandExportedName, commandFile);
  });
};

const sfdxApi = {};
buildAllCommands();
module.exports = sfdxApi;
