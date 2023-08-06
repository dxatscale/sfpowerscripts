/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import { Flags } from '@oclif/core';
import { Messages, validateSalesforceId } from '@salesforce/core';

Messages.importMessagesDirectory(__dirname);
const messages = Messages.loadMessages('@salesforce/sf-plugins-core', 'messages');

export type IdFlagConfig = {
  /**
   * Can specify if the version must be 15 or 18 characters long or 'both'. Leave blank to allow either 15 or 18.
   */
  length?: 15 | 18 | 'both';
  /**
   * If the ID belongs to a certain sobject type, specify the 3 character prefix.
   */
  startsWith?: string;
};

/**
 * Id flag with built-in validation.  Short character is `i`
 *
 * @example
 *
 * ```
 * import { Flags } from '@salesforce/sf-plugins-core';
 * public static flags = {
 *     // set length or prefix
 *    'flag-name': salesforceId({ length: 15, startsWith: '00D' }),
 *    // add flag properties
 *    'flag2': salesforceId({
 *        required: true,
 *        description: 'flag2 description',
 *     }),
 *    // override the character i
 *    'flag3': salesforceId({
 *        char: 'j',
 *     }),
 * }
 * ```
 */
export const salesforceIdFlag = Flags.custom<string, IdFlagConfig>({
  // eslint-disable-next-line @typescript-eslint/require-await
  parse: async (input, _ctx, opts) => validate(input, opts),
  char: 'i',
});

const validate = (input: string, config?: IdFlagConfig): string => {
  const { length, startsWith } = config ?? {};

  // If the flag doesn't specify a length or specifies "both", then let it accept both 15 or 18.
  const allowedIdLength = !length || length === 'both' ? [15, 18] : [length];

  if (!allowedIdLength.includes(input.length)) {
    throw messages.createError('errors.InvalidIdLength', [
      allowedIdLength.join(` ${messages.getMessage('errors.InvalidIdLength.or')} `),
    ]);
  }
  if (!validateSalesforceId(input)) {
    throw messages.createError('errors.InvalidId');
  }
  if (startsWith && !input.startsWith(startsWith)) {
    throw messages.createError('errors.InvalidPrefix', [startsWith]);
  }
  return input;
};
