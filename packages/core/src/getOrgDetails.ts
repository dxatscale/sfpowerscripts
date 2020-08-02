import child_process = require("child_process");
let fs = require("fs-extra");
let path = require("path");

export default function getOrgDetails(username: string): any {
 
  try {
    console.log("Querying Org Details");
    let result = child_process.execSync(
      `sfdx force:data:soql:query -q "SELECT Id, InstanceName, IsSandbox, Name, OrganizationType FROM Organization" -u ${username} --json`,
      { encoding: "utf8" }
    );
    let resultAsJSON = JSON.parse(result);
    if (resultAsJSON["status"] == 0) {
      console.log(resultAsJSON["result"]["records"][0]);
      return resultAsJSON["result"]["records"][0];
    } else {
        throw new Error(`Unable to fetch Org details`); 
    }
  } catch (error) {
    throw new Error(`Unable to fetch Org details`);
  }
}

