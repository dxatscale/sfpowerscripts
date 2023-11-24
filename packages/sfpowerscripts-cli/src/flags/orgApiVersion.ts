/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import { Flags } from '@oclif/core';
import { Messages, Lifecycle, OrgConfigProperties, validateApiVersion } from '@salesforce/core';

Messages.importMessagesDirectory(__dirname);
const messages = Messages.loadMessages('@dxatscale/sfpowerscripts', 'core-messages');

// versions below this are retired
export const minValidApiVersion = 21;
// this and all un-retired versions below it are deprecated
export const maxDeprecated = 30;
export const maxDeprecatedUrl = 'https://help.salesforce.com/s/articleView?id=000354473&type=1;';

/**const messages = Messages.loadMessages('@dxatscale/sfpowerscripts', 'core-messages');
 * apiVersion for a salesforce org's rest api.
 * Will validate format and that the api version is still supported.
 * Will default to the version specified in Config, if it exists (and will provide an override warning)
 *
 * CAVEAT: unlike the apiversion flag on sfdxCommand, this does not set the version on the org/connection
 * We leave this up to the plugins to implement
 *
 * @example
 *
 * ```
 * import { Flags } from '@salesforce/sf-plugins-core';
 * public static flags = {
 *    'api-version': Flags.orgApiVersion({
 *       char: 'a',
 *       description: 'api version for the org'
 *    }),
 * }
 * ```
 */
export const orgApiVersionFlag = Flags.custom({
  aliases: ['apiversion'],
  parse: async (input) => validate(input),
  default: async () => getDefaultFromConfig(),
  description: messages.getMessage('flags.apiVersion.description'),
});

const getDefaultFromConfig = async (): Promise<string | undefined> => {
  // (perf) only import ConfigAggregator if necessary
  const { ConfigAggregator } = await import('@salesforce/core');
  const config = await ConfigAggregator.create();
  const apiVersionFromConfig = config.getInfo(OrgConfigProperties.ORG_API_VERSION)?.value as string;
  if (apiVersionFromConfig) {
    await Lifecycle.getInstance().emitWarning(
      messages.getMessage('flags.apiVersion.overrideWarning', [apiVersionFromConfig])
    );
    return validate(apiVersionFromConfig);
  }
};

const validate = async (input: string): Promise<string> => {
  // basic format check
  if (!validateApiVersion(input)) {
    throw messages.createError('errors.InvalidApiVersion', [input]);
  }
  const requestedVersion = parseInt(input, 10);
  if (requestedVersion < minValidApiVersion) {
    throw messages.createError('errors.RetiredApiVersion', [minValidApiVersion]);
  }
  if (requestedVersion <= maxDeprecated) {
    await Lifecycle.getInstance().emitWarning(
      messages.getMessage('flags.apiVersion.warning.deprecated', [maxDeprecated, maxDeprecatedUrl])
    );
  }
  return input;
};
