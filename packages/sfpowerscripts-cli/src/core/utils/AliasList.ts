import { StateAggregator } from '@salesforce/core';


export async function convertAliasToUsername(alias: string) {
    const stateAggregator = await StateAggregator.getInstance();
    await stateAggregator.orgs.readAll();
    return await stateAggregator.aliases.resolveUsername(alias)
}

export async function convertUsernameToAlias(username: string) {
   
    const stateAggregator = await StateAggregator.getInstance();
    await stateAggregator.orgs.readAll();
    return await stateAggregator.aliases.resolveAlias(username)
  
}
