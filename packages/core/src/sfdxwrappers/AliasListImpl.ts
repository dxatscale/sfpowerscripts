import child_process = require("child_process");

/**
 * Returns list of aliases and their corresponding username, as an array of objects
 */
export default class AliasListImpl {

  public exec(): {alias: string, value: string}[] {
    let aliasListJSON: string = child_process.execSync(
      `sfdx alias:list --json`,
      {
        encoding: "utf8",
        stdio: ["pipe", "pipe", "inherit"],
      }
    );

    let aliasList = JSON.parse(aliasListJSON);
    if (aliasList.status === 0)
      return aliasList.result;
    else
      throw new Error(`Failed to retrieve list of username aliases`);
  }
}
