import * as path from "path";
import { registerNamespace } from "./sfdxnode/parallel";
import child_process = require("child_process");

export async function loadSFDX(sfdxmoduleDirectory: string) {
  let yarnGlobalPath = "";
  let npmGlobalPath = "";

  try {
    yarnGlobalPath = child_process.execSync("yarn global dir").toString();
  } catch (error) {
    yarnGlobalPath = "";
  }
  try {
    npmGlobalPath = child_process.execSync("npm root -g").toString();
  } catch (error) {
    npmGlobalPath = "";
  }

  const ALM_PATH = path.dirname(
    require.resolve("salesforce-alm", {
      paths: [
        path.join(
          process.env.LOCALAPPDATA,
          "/sfdx/node_modules/salesforce-alm"
        ),
        path.join(yarnGlobalPath, "node_modules/salesforce-alm"),
        path.join(npmGlobalPath, "salesforce-alm"),
        sfdxmoduleDirectory,
      ],
    })
  );

  const SFPOWERKIT_PATH = path.dirname(
    require.resolve("sfpowerkit", {
      paths: [
        path.join(process.env.LOCALAPPDATA, "/sfdx/node_modules/sfpowerkit"),
        path.join(yarnGlobalPath, "node_modules/sfpowerkit"),
        path.join(npmGlobalPath, "sfpowerkit"),
        sfdxmoduleDirectory,
      ],
    })
  );

  console.log(ALM_PATH);

  registerNamespace({
    commandsDir: path.join(ALM_PATH, "commands"),
    namespace: "force",
  });

  registerNamespace({
    commandsDir: path.join(SFPOWERKIT_PATH, "commands"),
    namespace: "sfpowerkit",
  });
}
