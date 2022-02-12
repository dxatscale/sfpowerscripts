import AliasListImpl from "../sfdxwrappers/AliasListImpl";

export async  function convertAliasToUsername(alias: string) {
  let aliasList = await (new AliasListImpl()).exec();

  let matchedAlias = aliasList.find((elem) => {
    return elem.alias === alias;
  });

  if (matchedAlias !== undefined)
    return matchedAlias.value;
  else
    return alias;
}