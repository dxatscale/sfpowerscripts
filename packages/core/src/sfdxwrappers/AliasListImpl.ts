import child_process = require("child_process");

export default class AliasListImpl {
  constructor(private alias: string) {}

  public exec(): string {
    let aliasListJSON: string = child_process.execSync(
      `sfdx alias:list --json`,
      {
        encoding: "utf8",
        stdio: ["pipe", "pipe", "inherit"],
      }
    );

    let matchedAlias;
    let aliasList = JSON.parse(aliasListJSON);
    if (aliasList.status === 0) {
      matchedAlias = aliasList.result.find((elem) => {
        return elem.alias === this.alias;
      });

      if (matchedAlias === undefined) {
        //alias doesnt exist,probably the user provided username,search for it, do one more pass
        matchedAlias = aliasList.result.find((elem) => {
          return elem.value === this.alias;
        });
      }
    }

    if (matchedAlias === undefined)
      throw new Error(`Failed to retrieve list of username aliases`);
    else return matchedAlias.value;
  }
}
