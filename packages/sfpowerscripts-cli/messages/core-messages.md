# error.prefix

Error%s:

# warning.security

This command will expose sensitive information that allows for subsequent activity using your current authenticated session. Sharing this information is equivalent to logging someone in under the current credential, resulting in unintended access and escalation of privilege. For additional information, please review the authorization section of the <https://developer.salesforce.com/docs/atlas.en-us.234.0.sfdx_dev.meta/sfdx_dev/sfdx_dev_auth_web_flow.htm>

# errors.RequiresProject

This command is required to run from within a Salesforce project directory.

# errors.InvalidIdLength

The id must be %s characters.

# errors.InvalidIdLength.or

or

# errors.InvalidId

The id is invalid.

# errors.InvalidPrefix

The id must begin with %s.

# errors.NoDefaultEnv

No default environment found. Use -o or --target-org to specify an environment.

# errors.NoDefaultDevHub

No default dev hub found. Use -v or --target-dev-hub to specify an environment.

# errors.NotADevHub

The specified org %s is not a Dev Hub.

# flags.targetOrg.summary

Username or alias of the target org.

# flags.targetDevHubOrg.summary

Username or alias of the Dev Hub org.

# flags.logsgroupsymbol.summary

Symbol used by CICD platform to group/collapse logs in the console. Provide an opening group, and an optional closing group symbol.

# flags.apiVersion.description

Override the api version used for api requests made by this command

# flags.apiVersion.overrideWarning

org-api-version configuration overridden at %s

# flags.apiVersion.warning.deprecated

API versions up to %s are deprecated. See %s for more information.

# errors.InvalidApiVersion

%s is not a valid API version. It should end in '.0' like '54.0'.

# errors.RetiredApiVersion

The API version must be greater than %s.

# errors.InvalidDuration

The value must be an integer.

# errors.DurationBounds

The value must be between %s and %s (inclusive).

# errors.DurationBoundsMin

The value must be at least %s.

# errors.DurationBoundsMax

The value must be no more than %s.

# warning.prefix

Warning:

# warning.loglevel

The loglevel flag is no longer in use on this command. You may use it without error, but it will be ignored.
Set the log level using the `SFDX_LOG_LEVEL` environment variable.

# actions.tryThis

Try this:

# warning.CommandInBeta

This command is currently in beta. Any aspect of this command can change without advanced notice. Don't use beta commands in your scripts.

# error.InvalidArgumentFormat

Error in the following argument
%s
Set varargs with this format: key=value or key="value with spaces"

# error.DuplicateArgument

Found duplicate argument %s.

# warning.arrayInputFormat

The input format for array arguments has changed. Use this format: --array-flag value1 --array-flag value2 --array-flag value3