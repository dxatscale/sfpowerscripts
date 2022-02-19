import { Aliases, AliasGroup } from "@salesforce/core";
import { Dictionary } from '@salesforce/ts-types';

export async  function convertAliasToUsername(alias: string) {

  
  const aliases = await Aliases.create(Aliases.getDefaultOptions());
  const keyValues = (aliases.getGroup(AliasGroup.ORGS) as Dictionary<string>) || {};
  const aliasList = Object.keys(keyValues).map((alias) => ({
    alias,
    value: keyValues[alias],
  }));

  let matchedAlias = aliasList.find((elem) => {
    return elem.alias === alias;
  });

  if (matchedAlias !== undefined)
    return matchedAlias.value;
  else
    return alias;
}