import { registerNamespace } from "sfdx-node";
import child_process = require("child_process");
import * as path from "path";

export async function loadsfpowerkit(modulePath: string) {

  console.log("Module Path to be used for sfpowerkit", modulePath);

  let  sfpowerkit_path = path.dirname(
    require.resolve("sfpowerkit", {
      paths: [
        path.join(modulePath, "/sfdx/node_modules/sfpowerkit")
      ],
    })
  );
  console.log(sfpowerkit_path);

  registerNamespace({
    commandsDir: path.join(sfpowerkit_path, "commands"),
    namespace: "sfpowerkit",
  });
}
