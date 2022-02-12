import { Aliases, AliasGroup } from "@salesforce/core";
import { Dictionary } from '@salesforce/ts-types';


/**
 * Returns list of aliases and their corresponding username, as an array of objects
 */
export default class AliasListImpl {

  public async exec(): Promise<{ alias: string; value: string; }[]> {


    const aliases = await Aliases.create(Aliases.getDefaultOptions());
    const keyValues = (aliases.getGroup(AliasGroup.ORGS) as Dictionary<string>) || {};
    const results = Object.keys(keyValues).map((alias) => ({
      alias,
      value: keyValues[alias],
    }));

    return results;
  }
}
