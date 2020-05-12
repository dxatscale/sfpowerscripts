import tl = require("azure-pipelines-task-lib/task");
import child_process = require("child_process");
import * as secureFilesCommon from "../Common/SecureFileHelpers";
import { isNullOrUndefined } from "util";
import { AppInsights } from "../Common/AppInsights";
import fs = require("fs-extra");
import path = require("path");
const nanoid = require('nanoid')


async function run() {
  try {
    const method: string = tl.getInput("method", true);
    const isDevHub: boolean = tl.getBoolInput("isdevhub", true);
    const alias: string = tl.getInput("alias", true);

    AppInsights.setupAppInsights(tl.getBoolInput("isTelemetryEnabled",true));
    AppInsights.trackTask("sfpwowerscript-authenticateorg-task");


    if (tl.getVariable("Agent.OS") == "Windows_NT") {
    
      tl.debug("Writing key.json");
      let keyFilePath=path.join(process.env.USERPROFILE,'.sfdx','key.json');
      let keyObj={};
      keyObj["service"]="sfdx";
      keyObj["account"]="local";
      keyObj["key"]=nanoid(32);
      fs.writeJSONSync(keyFilePath,keyObj);
    }

    if (method == "JWT") {
      const jwt_key_file: string = tl.getInput("jwt_key_file", true);
      const clientid: string = tl.getInput("clientid", true);
      const username: string = tl.getInput("username", true);
      const secureFileHelpers: secureFilesCommon.SecureFileHelpers = new secureFilesCommon.SecureFileHelpers();
      const jwt_key_filePath: string = await secureFileHelpers.downloadSecureFile(
        jwt_key_file
      );

      authUsingJWT(isDevHub, alias, clientid, jwt_key_filePath, username);

      AppInsights.trackTaskEvent("sfpwowerscript-authenticateorg-task","authUsingJWT");

    } else if (method == "Credentials") {
      const username: string = tl.getInput("username", true);
      const password: string = tl.getInput("password", true);
      const securitytoken: string = tl.getInput("securitytoken", false);

      authUsingCreds(isDevHub, alias, username, password, securitytoken);

      AppInsights.trackTaskEvent("sfpwowerscript-authenticateorg-task","authUsingCreds");
    }
    else if (method == "ServiceConnection")
    {
     let connection:string = tl.getInput("salesforce_connection", true);
     const username: string = tl.getEndpointAuthorizationParameter(connection,"username", true);
     const password: string = tl.getEndpointAuthorizationParameter(connection,"password", true);
     const securitytoken: string = tl.getEndpointAuthorizationParameter(connection,"securitytoken", false);
     const isDevHub: boolean = tl.getEndpointAuthorizationParameter(connection,"environment", false)=='Production'?true:false;
    
     authUsingCreds(isDevHub, alias, username, password, securitytoken);
     AppInsights.trackTaskEvent("sfpwowerscript-authenticateorg-task","authUsingConn");
    }
  } catch (err) {
    tl.setResult(tl.TaskResult.Failed, err.message);
    AppInsights.trackExcepiton("sfpwowerscript-authenticateorg-task");
  }
}

run();

function authUsingCreds(
  isDevHub: boolean,
  alias: string,
  username: string,
  password: string,
  securitytoken: string
) {
  if (isDevHub) {
    console.log(`SFPowerScript.. Authenticate DevHub ${alias}`);
    if (isNullOrUndefined(securitytoken)) {
      child_process.execSync(
        `sfdx sfpowerkit:auth:login -u ${username} -p ${password} -r https://login.salesforce.com -a ${alias} `
      );
    } else {
      child_process.execSync(
        `sfdx sfpowerkit:auth:login -u ${username} -p ${password} -s ${securitytoken}  -r https://login.salesforce.com -a ${alias} `
      );
      console.log(
        `Successfully authenticated to DevHub with username ${username} using credentials, The alias is ${alias} `
      );
    }
  } else {
    if (isNullOrUndefined(securitytoken)) {
      child_process.execSync(
        `sfdx sfpowerkit:auth:login -u ${username} -p ${password}  -a ${alias} `
      );
    } else {
      child_process.execSync(
        `sfdx sfpowerkit:auth:login -u ${username} -p ${password} -s ${securitytoken} -a ${alias} `
      );

      console.log(
        `Successfully authenticated to Sandbox with username ${username} using credentials, The alias is  ${alias} `
      );
    }
  }
}

function authUsingJWT(
  isDevHub: boolean,
  alias: string,
  clientid: string,
  jwt_key_filePath: string,
  username: string
) {
  if (isDevHub) {
    console.log(`SFPowerScript.. Authenticate DevHub ${alias}`);
    console.log(
      `Successfully authenticated to DevHub with username ${username} using JWT based authentication, The alias is ${alias} `
    );
    child_process.execSync(
      `npx sfdx force:auth:jwt:grant --clientid ${clientid} --jwtkeyfile ${jwt_key_filePath} --username ${username} --setdefaultdevhubusername --setalias ${alias}`
    );
  } else {
    console.log(`SFPowerScript.. Authenticate Sandbox ${alias} `);

    child_process.execSync(
      `npx sfdx force:auth:jwt:grant --clientid ${clientid} --jwtkeyfile ${jwt_key_filePath} --username ${username} --setdefaultusername --setalias ${alias} -r https://test.salesforce.com `
    );

    console.log(
      `Successfully authenticated to Sandbox with username ${username} using JWT based authentication, The alias is  ${alias} `
    );
  }
}
