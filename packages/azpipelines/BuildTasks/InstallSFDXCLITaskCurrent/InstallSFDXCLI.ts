import tl = require("azure-pipelines-task-lib/task");
import child_process = require("child_process");
import * as fs from "fs-extra"
import { isNullOrUndefined } from "util";
import path = require("path");

async function run() {
  try {
    console.log("SFPowerScript.. Install SFDX/SFPowerkit");

    const cli_version: string = tl.getInput("sfdx_cli_version", false);
    const sfpowerkit_version: string = tl.getInput("sfpowerkit_version", false);
    const sfdx_plugins: string = tl.getInput("plugins", false);
    const salesforce_api_version: string = tl.getInput(
      "salesforce_api_version",
      false
    );
    const isStatsDClientEnabled: boolean = tl.getBoolInput(
      "enableStatsd",
      false
    );

    let plugins: string[] = [];
    let sfdx_homedirectory;
    let whitelistpath = "";

    if (!isNullOrUndefined(sfdx_plugins)) plugins = sfdx_plugins.split(",");

    plugins.push(`sfpowerkit@${sfpowerkit_version}`);

    if (tl.getVariable("Agent.OS") == "Windows_NT") {
      let output = child_process.execSync(
        `npm install -g  sfdx-cli@${cli_version}`,
        { encoding: "utf8" }
      );
      console.log(output);
      sfdx_homedirectory = process.env.LOCALAPPDATA;
      whitelistpath = path.join(sfdx_homedirectory, "sfdx");
    } else if (tl.getVariable("Agent.OS") == "Darwin") {
      let output = child_process.execSync(
        `npm install -g sfdx-cli@${cli_version}`,
        { encoding: "utf8" }
      );
      console.log(output);
      sfdx_homedirectory = require("os").homedir();
      whitelistpath = path.join(sfdx_homedirectory, "sfdx");
    } else {
      let output = child_process.execSync(
        `sudo yarn global add sfdx-cli@${cli_version}`,
        { encoding: "utf8" }
      );
      console.log(output);
      sfdx_homedirectory = require("os").homedir();
      whitelistpath = path.join(sfdx_homedirectory, ".config", "sfdx");
    }

    let pluginsToWhitelist: string[] = [];

    plugins.forEach((element) => {
      pluginsToWhitelist.push(element.split("@")[0]);
    });

    console.log("SFDX CLI Installed");

    tl.debug(`HomeDirectory: ${sfdx_homedirectory}`);
    tl.debug(`WhiteListPath: ${whitelistpath}`);

    console.log(`Installing Plugins`);
    console.log(plugins);

    console.log(`Whitelisting Plugins`);
    console.log(pluginsToWhitelist);

    fs.ensureDirSync(whitelistpath);
    fs.writeJSONSync(
      path.join(whitelistpath, "unsignedPluginAllowList.json"),
      pluginsToWhitelist
    );

    plugins.forEach((element) => {
      console.log(`Installing Plugin ${element}`);
      let output = child_process.execSync(`sfdx plugins:install ${element}`, {
        encoding: "utf8",
      });
      console.log(output);

      console.log("Setting API Version if any..");
      if (!isNullOrUndefined(salesforce_api_version)) {
        let output = child_process.execSync(
          `sfdx force:config:set apiVersion=${salesforce_api_version}`,
          { encoding: "utf8" }
        );
        console.log(output);

        console.log("API Version set succesfully");
      }
    });

    if (isStatsDClientEnabled) {
      const statsDConfig: string = tl.getInput("statsd_config", false);
      if (statsDConfig != null) {
        let statsDConfigDetails = statsDConfig.split(":");

        switch (statsDConfigDetails.length) {
          case 1:
            console.log("Found one statsd config from the input,using the rest of the config based on defaults");
            tl.setVariable(
              "SFPOWERSCRIPTS_STATSD_HOST",
              statsDConfigDetails[0]
            );
            tl.setVariable("SFPOWERSCRIPTS_STATSD_PORT", "8125");
            tl.setVariable("SFPOWERSCRIPTS_STATSD_PROTOCOL", "udp");
            break;

          case 2:
            console.log("Found two statsd config from the input,using the default protocol");
            tl.setVariable(
              "SFPOWERSCRIPTS_STATSD_HOST",
              statsDConfigDetails[0]
            );
            tl.setVariable("SFPOWERSCRIPTS_STATSD_PORT",statsDConfigDetails[1] );
            tl.setVariable("SFPOWERSCRIPTS_STATSD_PROTOCOL", "udp");
            break;

          case 3:
              tl.setVariable(
                "SFPOWERSCRIPTS_STATSD_HOST",
                statsDConfigDetails[0]
              );
              tl.setVariable("SFPOWERSCRIPTS_STATSD_PORT",statsDConfigDetails[1] );
              tl.setVariable("SFPOWERSCRIPTS_STATSD_PROTOCOL",statsDConfigDetails[2]);
              break;

          default:
                tl.warning("Incorrect StatsD config passed, Please check the documentation");
        }
      }
    }
  } catch (err) {
    tl.setResult(tl.TaskResult.Failed, err.message);
  }
}

run();
