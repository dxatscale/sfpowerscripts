import AliasListImpl from "../sfdxwrappers/AliasListImpl";

export  function convertAliasToUsername(alias: string) {
  let aliasList = new AliasListImpl().exec();

  let matchedAlias = aliasList.find((elem) => {
    return elem.alias === alias;
  });

  if (matchedAlias !== undefined)
    return matchedAlias.value;
  else
    return alias;
}