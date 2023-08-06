/*
 * Modified from sfdx-plugins-core to meet sfpowerscripts requirment
 * sfpowerscripts is not moving to the new style immediately 
 * to reduce migration efforts in pipelines
 * 
 * 
 * Original Copyright
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { Flags } from '@oclif/core';
import { Lifecycle, Messages, Org, OrgConfigProperties } from '@salesforce/core';
import { orgApiVersionFlag } from './orgApiVersion';
import { getHubOrThrow, getOrgOrThrow, maybeGetHub, maybeGetOrg, optionalHubFlag, optionalOrgFlag, requiredHubFlag, requiredOrgFlag } from './orgFlags';
import { AliasAccessor } from '@salesforce/core/lib/stateAggregator';

/**
 * Adds an alias for the orgApiVersionFlag

 */
export const orgApiVersionFlagSfdxStyle = orgApiVersionFlag({
  aliases: ['apiversion'],
});

Messages.importMessagesDirectory(__dirname);
const messages = Messages.loadMessages('@dxatscale/sfpowerscripts', 'core-messages');
/**
 * Use only for commands that maintain sfdx compatibility.
 * Flag will be hidden and will show a warning if used.
 * Flag does *not* set the loglevel
 *
 *
 */
export const loglevel = Flags.string({
  description: 'logging level for this command invocation',
  default: 'info',
  required: false,
  options: [
      'trace',
      'debug',
      'info',
      'warn',
      'error',
      'fatal',
      'TRACE',
      'DEBUG',
      'INFO',
      'WARN',
      'ERROR',
      'FATAL',
  ],
});

const orgAliases = {
  aliases: ['targetusername', 'u'],
};




const userNameFlag = Flags.custom({
  ...orgAliases,
  char: 'u',
  summary: messages.getMessage('flags.targetOrg.summary'),
  parse: async (input: string | undefined) =>  {
    let aliasAccessor = (await AliasAccessor.create());
    if(aliasAccessor.resolveAlias(input))
      return aliasAccessor.resolveAlias(input);
    else
      return aliasAccessor.resolveUsername(input);
   
  },
});

export const optionalUserNameFlag = userNameFlag({
  aliases: ['targetusername', 'u'],
  char: 'u',
});

export const requiredUserNameFlag = userNameFlag({
  aliases: ['targetusername', 'u'],
  char: 'u',
  required: true,
});

const devhubFlag = Flags.custom({
  char: 'v',
  summary: messages.getMessage('flags.targetDevHubOrg.summary'),
  parse: async (input: string | undefined) => (await getHubOrThrow(input)).getUsername(),
  default: async () => (await getHubOrThrow()).getUsername(),
  defaultHelp: async (context, isWritingManifest) => {
    if (isWritingManifest) {
      return undefined;
    }
    if (context.options instanceof Org) {
      const org = context.options as Org;
      return org.getUsername();
    }
    return (await maybeGetHub())?.getUsername();
  },
});


export const requiredDevHubFlag = devhubFlag({
  aliases: ['targetdevhubusername'],
  required: true,
});


export const optionalDevHubFlag = devhubFlag({
  aliases: ['targetdevhubusername'],
  required: false,
});

export type ArrayWithOptions = {
  // prevent invalid options from being passed
  multiple?: true;
  // parse is disallowed because we have to overwrite it
  parse?: undefined;
};
/**
 */
export const arrayFlagSfdxStyle = Flags.custom<string[], ArrayWithOptions>({
  multiple: true,
  delimiter: ',',
  // eslint-disable-next-line @typescript-eslint/ban-ts-comment
  // @ts-expect-error parse expects to return string[] but we need to return string.
  // This is a weird consequence of implementing an array flag. The oclif parser splits the input (e.g. "thing1,thing2")
  // on the delimiter and passes each value individually to the parse function. However, the return type needs to be
  // string[] so that upstream consumers have the correct flag typings.
  parse: async (input, ctx) => {
    const inputParts = ctx.token.input.split(',').map((i) => i.trim());
    if (inputParts.length > 1) {
      await Lifecycle.getInstance().emitWarning(messages.getMessage('warning.arrayInputFormat'));
    }

    return input;
  },
});

export const logsgroupsymbol = arrayFlagSfdxStyle({
  char: 'g',
  description: messages.getMessage('flags.logsgroupsymbol.summary'),
});