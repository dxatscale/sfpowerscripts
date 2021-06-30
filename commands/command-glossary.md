---
description: Commands in sfpowerscripts
---

# Command Glossary

## Commands

* Orchestrator Commands
  * [`sfdx sfpowerscripts:orchestrator:prepare`](command-glossary.md#sfdx-sfpowerscriptsorchestratorprepare)
  * [`sfdx sfpowerscripts:orchestrator:validate`](command-glossary.md#sfdx-sfpowerscriptsorchestratorvalidate)
  * [`sfdx sfpowerscripts:orchestrator:validateAgainstOrg`](command-glossary.md#sfdx-sfpowerscriptsorchestratorvalidateagainstorg)
  * [`sfdx sfpowerscripts:orchestrator:quickbuild`](command-glossary.md#sfdx-sfpowerscriptsorchestratorquickbuild)
  * [`sfdx sfpowerscripts:orchestrator:build`](command-glossary.md#sfdx-sfpowerscriptsorchestratorbuild)
  * [`sfdx sfpowerscripts:orchestrator:deploy`](command-glossary.md#sfdx-sfpowerscriptsorchestratordeploy)
  * [`sfdx sfpowerscripts:orchestrator:promote`](command-glossary.md#sfdx-sfpowerscriptsorchestratorpromote)
  * [`sfdx sfpowerscripts:orchestrator:publish`](command-glossary.md#sfdx-sfpowerscriptsorchestratorpublish)
* Changelog \(Track Releases\)
  * [`sfdx sfpowerscripts:changelog:generate`](command-glossary.md#sfdx-sfpowerscriptschangeloggenerate)
* Package Commands \( Build your own workflow\)
  * [`sfdx sfpowerscripts:package:data:create`](command-glossary.md#sfdx-sfpowerscriptspackagedatacreate)
  * [`sfdx sfpowerscripts:package:data:install`](command-glossary.md#sfdx-sfpowerscriptspackagedatainstall)
  * [`sfdx sfpowerscripts:package:source:create`](command-glossary.md#sfdx-sfpowerscriptspackagesourcecreate)
  * [`sfdx sfpowerscripts:package:source:install`](command-glossary.md#sfdx-sfpowerscriptspackagesourceinstall)
  * [`sfdx sfpowerscripts:package:unlocked:create`](command-glossary.md#sfdx-sfpowerscriptspackageunlockedcreate)
  * [`sfdx sfpowerscripts:package:unlocked:install`](command-glossary.md#sfdx-sfpowerscriptspackageunlockedinstall)
  * [`sfdx sfpowerscripts:package:version:increment`](command-glossary.md#sfdx-sfpowerscriptspackageversionincrement)
* Pool Management
  * [`sfdx sfpowerscripts:pool:delete`](command-glossary.md#sfdx-sfpowerscriptspooldelete)
  * [`sfdx sfpowerscripts:pool:fetch`](command-glossary.md#sfdx-sfpowerscriptspoolfetch)
  * [`sfdx sfpowerscripts:pool:list`](command-glossary.md#sfdx-sfpowerscriptspoollist)
* Static Analysis
  * [`sfdx sfpowerscripts:analyze:pmd`](command-glossary.md#sfdx-sfpowerscriptsanalyzepmd)
* Apex tests
  * [`sfdx sfpowerscripts:apextests:trigger`](command-glossary.md#sfdx-sfpowerscriptsapexteststrigger)
  * [`sfdx sfpowerscripts:apextests:validate`](command-glossary.md#sfdx-sfpowerscriptsapextestsvalidate)
* Artifacts
  * \`\`[`sfdx sfpowerscripts:artifacts:fetch`](command-glossary.md#sfdx-sfpowerscripts-artifacts-fetch)\`\`

## `sfdx sfpowerscripts:orchestrator:prepare`

Prepare a pool of scratchorgs with all the packages upfront, so that any incoming change can be validated in an optimized manner, Please note for this feature to work the devhub should be enabled and scratchorgpool \(additional fields to ScratchOrgInfo object\) should be deployed to devhub. Please see the instructions [here](https://github.com/Accenture/sfpowerkit/wiki/Getting-started-with-ScratchOrg-Pooling#1-install-the-supporting-fields-and-validation-rule-to-devhub). This command also install an unlocked package to the scratch org 'sfpowerscripts-artifact' \(04t1P000000ka9mQAA\) for skipping unchanged packages during a validation phase. This particular package can be prebuilt against your org and the ID could be overriden by setting up the environment variable SFPOWERSCRIPTS\_ARTIFACT\_UNLOCKED\_PACKAGE

```text
Prepare a pool of scratchorgs with all the packages upfront, so that any incoming change can be validated in an optimized manner,


USAGE
  $ sfdx sfpowerscripts:orchestrator:prepare -t <string> [-e <number>] [-m <number>] [-f <filepath>]
  [--installassourcepackages --installall] [-s <filepath>] [--succeedondeploymenterrors] [--keys <string>] [-v <string>]
  [--apiversion <string>]

OPTIONS
  -e, --expiry=expiry                                                               [default: 2] Expiry of the scratch
                                                                                    org's created in the pool

  -f, --config=config                                                               [default:
                                                                                    config/project-scratch-def.json] The
                                                                                    file path to the definition file for
                                                                                    the scratch org shape

  -m, --maxallocation=maxallocation                                                 [default: 10] The size of the
                                                                                    scratch org pool to be created

  -s, --artifactfetchscript=artifactfetchscript                                     The path to the script file that is
                                                                                    used to fetch the validated
                                                                                    artifacts to be used in the prepare
                                                                                    command

  -t, --tag=tag                                                                     (required) The name/tag of the
                                                                                    scratch org pool

  -v, --targetdevhubusername=targetdevhubusername                                   username or alias for the dev hub
                                                                                    org; overrides default dev hub org

  --apiversion=apiversion                                                           API version to be used

  --installall                                                                      Install the dependencies,along with
                                                                                    all the packages in the repo

  --installassourcepackages                                                         Install all packages as Source
                                                                                    packages


  --keys=keys                                                                       Keys to be used while installing any
                                                                                    managed package dependent


  --succeedondeploymenterrors                                                       Do not fail the scratch orgs, if a
                                                                                    package failed to deploy, return the
                                                                                    scratch org with packages till the
                                                                                    last failure

EXAMPLE
  $ sfdx sfpowerscripts:orchestrator:prepare -t CI_1  -v <devhub>
```

_See code:_ [_commands/sfpowerscripts/orchestrator/prepare.ts_](https://github.com/Accenture/sfpowerscripts/tree/develop/packages/sfpowerscripts-cli/src/commands/sfpowerscripts/orchestrator/prepare.ts)

## `sfdx sfpowerscripts:orchestrator:validate`

Validate the incoming change against a prepared scratch org fetched from the provided pools \(created using the prepare command\). If the Sfpowerscripts Artifact package is installed in the scratch orgs, only the changed packages in the repo will be deployed by comparing against the package version installed in the fetched scratchorg.

```text
Validate the incoming change against a prepared scratch org fetched from the provided pools.

USAGE
  $ sfdx sfpowerscripts:orchestrator:validate -u <string> -p <array> -f <filepath> -i <string> [--shapefile <string>]
  [--coveragepercent <integer>] [-g <array>] [-x]

OPTIONS
  -f, --jwtkeyfile=jwtkeyfile                                                       (required) Path to a file containing
                                                                                    the private key

  -g, --logsgroupsymbol=logsgroupsymbol                                             Symbol used by CICD platform to
                                                                                    group/collapse logs in the console.
                                                                                    Provide an opening group, and an
                                                                                    optional closing group symbol.

  -i, --clientid=clientid                                                           (required) OAuth client ID, also
                                                                                    known as the consumer key

  -p, --pools=pools                                                                 (required) Fetch scratch-org
                                                                                    validation environment from one of
                                                                                    listed pools, sequentially

  -u, --devhubusername=devhubusername                                               (required) Authentication username
                                                                                    for Dev Hub

  -x, --deletescratchorg                                                            Delete scratch-org validation
                                                                                    environment, after the command has
                                                                                    finished running

  --coveragepercent=coveragepercent                                                 [default: 75] Minimum required
                                                                                    percentage coverage for validating
                                                                                    code coverage of packages with Apex
                                                                                    classes


  --shapefile=shapefile                                                             Path to .zip file of scratch org
                                                                                    shape / metadata to deploy

EXAMPLE
  $ sfdx sfpowerscripts:orchestrator:validate -p "POOL_TAG_1,POOL_TAG_2" -u <devHubUsername> -i <clientId> -f <jwt_file>
```

_See code:_ [_commands/sfpowerscripts/orchestrator/validate.ts_](https://github.com/Accenture/sfpowerscripts/tree/develop/packages/sfpowerscripts-cli/src/commands/sfpowerscripts/orchestrator/validate.ts)

## `sfdx sfpowerscripts:orchestrator:validateAgainstOrg`

Validate the incoming change against a target org. If the Sfpowerscripts Artifact package is installed in the target org, only changed packages in the repo will be deployed by comparing against the package version installed in the target org.

```text
Validate the incoming change against target org

USAGE
  $ sfdx sfpowerscripts:orchestrator:validateAgainstOrg -u <string> [--coveragepercent <integer>] [-g <array>] [--json] [--loglevel
  trace|debug|info|warn|error|fatal|TRACE|DEBUG|INFO|WARN|ERROR|FATAL]

OPTIONS
  -g, --logsgroupsymbol=logsgroupsymbol                                             Symbol used by CICD platform to group/collapse logs in the console. Provide
                                                                                    an opening group, and an optional closing group symbol.

  -u, --targetorg=targetorg                                                         (required) Alias/User Name of the target environment

  --coveragepercent=coveragepercent                                                 [default: 75] Minimum required percentage coverage for validating code
                                                                                    coverage of packages with Apex classes

  --json                                                                            format output as json

  --loglevel=(trace|debug|info|warn|error|fatal|TRACE|DEBUG|INFO|WARN|ERROR|FATAL)  [default: warn] logging level for this command invocation

EXAMPLE
  $ sfdx sfpowerscripts:orchestrator:validateAgainstOrg -u <targetorg>
```

_See code:_ [_commands/sfpowerscripts/orchestrator/validateAgainstOrg.ts_](https://github.com/Accenture/sfpowerscripts/tree/develop/packages/sfpowerscripts-cli/src/commands/sfpowerscripts/orchestrator/validateAgainstOrg.ts)

## `sfdx sfpowerscripts:orchestrator:quickbuild`

Build packages \(unlocked/source/data\) in a repo in parallel, without validating depenencies or coverage in the case of unlocked packages. For diffcheck to work\(build packages that are changed\), it compares against the last know git tags, so make sure that you strategically place the tags push at the required state in your pipeline.

```text
Build packages (unlocked/source/data) in a repo in parallel, without validating depenencies or coverage in the case of unlocked packages

USAGE
  $ sfdx sfpowerscripts:orchestrator:quickbuild [--diffcheck] [--gittag] [-r <string>] [-f <filepath>] [--artifactdir
  <directory>] [--waittime <number>] [--buildnumber <number>] [--executorcount <number>] [--branch <string>] [--tag
  <string>] [-v <string>] [--apiversion <string>]

OPTIONS
  -f, --configfilepath=configfilepath                                               [default:
                                                                                    config/project-scratch-def.json]
                                                                                    Path in the current project
                                                                                    directory containing  config file
                                                                                    for the packaging org

  -r, --repourl=repourl                                                             Custom source repository URL to use
                                                                                    in artifact metadata, overrides
                                                                                    origin URL defined in git config

  -v, --targetdevhubusername=targetdevhubusername                                   username or alias for the dev hub
                                                                                    org; overrides default dev hub org

  --apiversion=apiversion                                                           override the api version used for
                                                                                    api requests made by this command

  --artifactdir=artifactdir                                                         [default: artifacts] The directory
                                                                                    where the generated artifact is to
                                                                                    be written

  --branch=branch                                                                   The git branch that this build is
                                                                                    triggered on, Useful for metrics and
                                                                                    general identification purposes

  --buildnumber=buildnumber                                                         [default: 1] The build number to be
                                                                                    used for source packages, Unlocked
                                                                                    Packages will be assigned the
                                                                                    buildnumber from Saleforce directly
                                                                                    if using .NEXT

  --diffcheck                                                                       Only build the packages which have
                                                                                    changed by analyzing previous tags

  --executorcount=executorcount                                                     [default: 5] Number of parallel
                                                                                    package task schedulors

  --gittag                                                                          Tag the current commit ID with an
                                                                                    annotated tag containing the package
                                                                                    name and version - does not push tag

  --tag=tag                                                                         Tag the build with a label, useful
                                                                                    to identify in metrics

  --waittime=waittime                                                               [default: 120] Wait time for command
                                                                                    to finish in minutes
```

_See code:_ [_commands/sfpowerscripts/orchestrator/quickbuild.ts_](https://github.com/Accenture/sfpowerscripts/tree/develop/packages/sfpowerscripts-cli/src/commands/sfpowerscripts/orchestrator/quickbuild.ts)

## `sfdx sfpowerscripts:orchestrator:build`

Build all packages \(unlocked/source/data\) in a repo in parallel, respecting the dependency of each packages and generate artifacts to a provided directory.For diffcheck to work\(build packages that are changed\), it compares against the last know git tags, so make sure that you strategically place the tags push at the required state in your pipeline.

```text
Build all packages (unlocked/source/data) in a repo in parallel, respecting the dependency of each packages and generate artifacts to a provided directory

USAGE
  $ sfdx sfpowerscripts:orchestrator:build [--diffcheck] [--gittag] [-r <string>] [-f <filepath>] [--artifactdir
  <directory>] [--waittime <number>] [--buildnumber <number>] [--executorcount <number>] [--branch <string>] [--tag
  <string>] [-v <string>] [--apiversion <string>]

OPTIONS
  -f, --configfilepath=configfilepath                                               [default:
                                                                                    config/project-scratch-def.json]
                                                                                    Path in the current project
                                                                                    directory containing  config file
                                                                                    for the packaging org

  -r, --repourl=repourl                                                             Custom source repository URL to use
                                                                                    in artifact metadata, overrides
                                                                                    origin URL defined in git config

  -v, --targetdevhubusername=targetdevhubusername                                   username or alias for the dev hub
                                                                                    org; overrides default dev hub org

  --apiversion=apiversion                                                           override the api version used for
                                                                                    api requests made by this command

  --artifactdir=artifactdir                                                         [default: artifacts] The directory
                                                                                    where the generated artifact is to
                                                                                    be written

  --branch=branch                                                                   The git branch that this build is
                                                                                    triggered on, Useful for metrics and
                                                                                    general identification purposes

  --buildnumber=buildnumber                                                         [default: 1] The build number to be
                                                                                    used for source packages, Unlocked
                                                                                    Packages will be assigned the
                                                                                    buildnumber from Saleforce directly
                                                                                    if using .NEXT

  --diffcheck                                                                       Only build the packages which have
                                                                                    changed by analyzing previous tags

  --executorcount=executorcount                                                     [default: 5] Number of parallel
                                                                                    package task schedulors

  --gittag                                                                          Tag the current commit ID with an
                                                                                    annotated tag containing the package
                                                                                    name and version - does not push tag

  --tag=tag                                                                         Tag the build with a label, useful
                                                                                    to identify in metrics

  --waittime=waittime                                                               [default: 120] Wait time for command
                                                                                    to finish in minutes
```

_See code:_ [_commands/sfpowerscripts/orchestrator/build.ts_](https://github.com/Accenture/sfpowerscripts/tree/develop/packages/sfpowerscripts-cli/src/commands/sfpowerscripts/orchestrator/build.ts)

## `sfdx sfpowerscripts:orchestrator:deploy`

Deploy packages from the provided aritfact directory, to a given org, using the order and configurable flags provided in sfdx-project.json `skipifalreadyinstalled` only works provide the target org has sfpowerscripts-artifact' \(04t1P000000ka9mQAA\) installed. Please note you can deploy your own instance of 'sfpowerscripts-artifact' by building it from the repo and overriding using the environment variable SFPOWERSCRIPTS\_ARTIFACT\_UNLOCKED\_PACKAGE

```text
Deploy packages from the provided aritfact directory, to a given org, using the order and configurable flags provided in sfdx-project.json

USAGE
  $ sfdx sfpowerscripts:orchestrator:deploy -u <string> [--artifactdir <directory>] [--waittime <number>] [-g <array>]
  [-t <string>] [--skipifalreadyinstalled]

OPTIONS
  -g, --logsgroupsymbol=logsgroupsymbol                                             Symbol used by CICD platform to
                                                                                    group/collapse logs in the console.
                                                                                    Provide an opening group, and an
                                                                                    optional closing group symbol.

  -t, --tag=tag                                                                     Tag the deploy with a label, useful
                                                                                    for identification in metrics

  -u, --targetorg=targetorg                                                         (required) [default: scratchorg]
                                                                                    Alias/User Name of the target
                                                                                    environment

  --artifactdir=artifactdir                                                         [default: artifacts] The directory
                                                                                    containing artifacts to be deployed


  --skipifalreadyinstalled                                                          Skip the package installation if the
                                                                                    package is already installed in the
                                                                                    org

  --waittime=waittime                                                               [default: 120] Wait time for command
                                                                                    to finish in minutes

EXAMPLE
  $ sfdx sfpowerscripts:orchestrator:deploy -u <username>
```

_See code:_ [_commands/sfpowerscripts/orchestrator/deploy.ts_](https://github.com/Accenture/sfpowerscripts/tree/develop/packages/sfpowerscripts-cli/src/commands/sfpowerscripts/orchestrator/deploy.ts)

## `sfdx sfpowerscripts:orchestrator:promote`

Promotes validated unlocked packages with code coverage greater than 75%

```text
Promotes validated unlocked packages with code coverage greater than 75%

USAGE
  $ sfdx sfpowerscripts:orchestrator:promote -d <directory> [-v <string>]
OPTIONS
  -d, --artifactdir=artifactdir                                                     (required) [default: artifacts] The
                                                                                    directory where artifacts are
                                                                                    located

  -v, --devhubalias=devhubalias                                                     [default: HubOrg] Provide the alias
                                                                                    of the devhub previously
                                                                                    authenticated, default value is
                                                                                    HubOrg if using the Authenticate
                                                                                    Devhub task


EXAMPLE
  $ sfdx sfpowerscripts:orchestrator:promote -d path/to/artifacts -v <org>
```

_See code:_ [_commands/sfpowerscripts/orchestrator/promote.ts_](https://github.com/Accenture/sfpowerscripts/tree/develop/packages/sfpowerscripts-cli/src/commands/sfpowerscripts/orchestrator/promote.ts)

## `sfdx sfpowerscripts:orchestrator:publish`

Publish packages to an artifact registry, using a user-provided script that is responsible for authenticating & uploading to the registry.

```text
Publish packages to an artifact registry, using a user-provided script that is responsible for authenticating & uploading to the registry.

USAGE
  $ sfdx sfpowerscripts:orchestrator:publish -d <directory> -f <filepath> [-p -v <string>] [-t <string>]
OPTIONS
  -d, --artifactdir=artifactdir                                                     (required) [default: artifacts] The
                                                                                    directory containing artifacts to be
                                                                                    published

  -f, --scriptpath=scriptpath                                                       (required) Path to script that
                                                                                    authenticates and uploaded artifacts
                                                                                    to the registry

  -p, --publishpromotedonly                                                         Only publish unlocked packages that
                                                                                    have been promoted

  -t, --tag=tag                                                                     Tag the publish with a label, useful
                                                                                    for identification in metrics

  -v, --devhubalias=devhubalias                                                     Provide the alias of the devhub
                                                                                    previously authenticated


EXAMPLES
  $ sfdx sfpowerscripts:orchestrator:publish -f path/to/script
  $ sfdx sfpowerscripts:orchestrator:publish -p -v HubOrg
```

_See code:_ [_commands/sfpowerscripts/orchestrator/publish.ts_](https://github.com/Accenture/sfpowerscripts/tree/develop/packages/sfpowerscripts-cli/src/commands/sfpowerscripts/orchestrator/publish.ts)

## `sfdx sfpowerscripts:orchestrator:release`

Initiate a release to an org, according to the release configuration defined in a release-definition YAML file

```text
Initiate a release to an org, according to the configuration defined in a release-definition YAML file

USAGE
  $ sfdx sfpowerscripts:orchestrator:release -u <string> [-p <filepath>] [--scope <string> [--npm | -f <filepath>]] [--npmrcpath <filepath> 
  undefined] [-g <array>] [-t <string>] [--waittime <number>] [--keys <string>] [-b <string> --generatechangelog] [-v <string>] [--json] 
  [--loglevel trace|debug|info|warn|error|fatal|TRACE|DEBUG|INFO|WARN|ERROR|FATAL]

OPTIONS
  -b, --branchname=branchname                                                       Repository branch in which the changelog files are 
                                                                                    located

  -f, --scriptpath=scriptpath                                                       (Optional: no-NPM) Path to script that authenticates and 
                                                                                    downloads artifacts from the registry

  -g, --logsgroupsymbol=logsgroupsymbol                                             Symbol used by CICD platform to group/collapse logs in 
                                                                                    the console. Provide an opening group, and an optional 
                                                                                    closing group symbol.

  -p, --releasedefinition=releasedefinition                                         Path to YAML file containing map of packages and package 
                                                                                    versions to download

  -t, --tag=tag                                                                     Tag the release with a label, useful for identification 
                                                                                    in metrics

  -u, --targetorg=targetorg                                                         (required) [default: scratchorg] Alias/User Name of the 
                                                                                    target environment

  -v, --devhubalias=devhubalias                                                     [default: HubOrg] Provide the alias of the devhub 
                                                                                    previously authenticated, default value is HubOrg

  --generatechangelog                                                               Create a release changelog

  --json                                                                            format output as json

  --keys=keys                                                                       Keys to be used while installing any managed package 
                                                                                    dependencies. Required format is a string of key-value 
                                                                                    pairs separated by spaces e.g. packageA:pw123 
                                                                                    packageB:pw123 packageC:pw123

  --loglevel=(trace|debug|info|warn|error|fatal|TRACE|DEBUG|INFO|WARN|ERROR|FATAL)  [default: warn] logging level for this command 
                                                                                    invocation

  --npm                                                                             Download artifacts from a pre-authenticated private npm 
                                                                                    registry

  --npmrcpath=npmrcpath                                                             Path to .npmrc file used for authentication to registry. 
                                                                                    If left blank, defaults to home directory

  --scope=scope                                                                     (required for NPM) User or Organisation scope of the NPM 
                                                                                    package

  --waittime=waittime                                                               [default: 120] Wait time for package installation

EXAMPLE
  sfdx sfpowerscripts:orchestrator:release -p path/to/releasedefinition.yml -u myorg --npm --scope myscope --generatechangelog
```

## `sfdx sfpowerscripts:changelog:generate`

Generates release changelog, providing a summary of artifact versions, work items and commits introduced in a release. Creates a release definition based on artifacts contained in the artifact directory, and compares it to previous release definition in changelog stored on a source repository

```text
Generates release changelog, providing a summary of artifact versions, work items and commits introduced in a release. Creates a release definition based on artifacts contained in the artifact directory, and compares it to previous release definition in changelog stored on a source repository

USAGE
  $ sfdx sfpowerscripts:changelog:generate -d <directory> -n <string> -w <string> -r <string> -b <string> [--limit
  <integer>] [--workitemurl <string>] [--showallartifacts]
OPTIONS

  -d, --artifactdir=artifactdir                                                     (required) [default: artifacts]
                                                                                    Directory containing sfpowerscripts
                                                                                    artifacts

  -n, --releasename=releasename                                                     (required) Name of the release for
                                                                                    which to generate changelog

  -r, --repourl=repourl                                                             (required) Repository in which the
                                                                                    changelog files are located. Assumes
                                                                                    user is already authenticated.

  -w, --workitemfilter=workitemfilter                                               (required) Regular expression used
                                                                                    to search for work items (user
                                                                                    stories) introduced in release

  --json                                                                            format output as json

  --limit=limit                                                                     limit the number of releases to
                                                                                    display in changelog markdown

  --loglevel=(trace|debug|info|warn|error|fatal|TRACE|DEBUG|INFO|WARN|ERROR|FATAL)  [default: warn] logging level for
                                                                                    this command invocation

  --showallartifacts                                                                Show all artifacts in changelog
                                                                                    markdown, including those that have
                                                                                    not changed in the release

  --workitemurl=workitemurl                                                         Generic URL for work items. Each
                                                                                    work item ID will be appended to the
                                                                                    URL, providing quick access to work
                                                                                    items

EXAMPLE
  $ sfdx sfpowerscripts:changelog:generate -n <releaseName> -d path/to/artifact/directory -w <regexp> -r <repoURL> -b
  <branchName>
```

_See code:_ [_commands/sfpowerscripts/changelog/generate.ts_](https://github.com/Accenture/sfpowerscripts/tree/develop/packages/sfpowerscripts-cli/src/commands/sfpowerscripts/changelog/generate.ts)

## `sfdx sfpowerscripts:analyze:pmd`

This task is used to run a static analysis of the apex classes and triggers using PMD, Please ensure that the SFDX CLI and sfpowerkit plugin are installed before using this task

```text
This task is used to run a static analysis of the apex classes and triggers using PMD, Please ensure that the SFDX CLI and sfpowerkit plugin are installed before using this task

USAGE
  $ sfdx sfpowerscripts:analyze:pmd [--sourcedir <string>] [--ruleset <string>] [--rulesetpath <string>] [--format
  <string>] [-o <string>] [--version <string>] [-b] [--refname <string>] [--json] [--loglevel
  trace|debug|info|warn|error|fatal|TRACE|DEBUG|INFO|WARN|ERROR|FATAL]

OPTIONS
  -b, --istobreakbuild                                                               Enable this option if the build
                                                                                     should be reported as failure if 1
                                                                                     or more critical defects are
                                                                                     reported during the analysis

  -o, --outputpath=outputpath                                                        The file to which the output for
                                                                                     static analysis will be written

  --format=text|textcolor|csv|emacs|summaryhtml|html|xml|xslt|yahtml|vbhtml|textpad  [default: text]
                                                                                     https://pmd.github.io/latest/pmd_us
                                                                                     erdocs_cli_reference.html#available
                                                                                     -report-formats

  --json                                                                             format output as json

  --loglevel=(trace|debug|info|warn|error|fatal|TRACE|DEBUG|INFO|WARN|ERROR|FATAL)   [default: warn] logging level for
                                                                                     this command invocation

  --refname=refname                                                                  Reference name to be prefixed to
                                                                                     output variables

  --ruleset=sfpowerkit|Custom                                                        [default: sfpowerkit] Inbuilt is
                                                                                     the default ruleset that comes with
                                                                                     the task, If you choose custom,
                                                                                     please provide the path to the
                                                                                     ruleset

  --rulesetpath=rulesetpath                                                          The path to the ruleset if you are
                                                                                     utilizing your own ruleset

  --sourcedir=sourcedir                                                              The directory that is to be analzed
                                                                                     using PMD, If omitted default
                                                                                     project diretory as mentioned in
                                                                                     sfdx-project.json will be used

  --version=version                                                                  [default: 6.26.0] The version of
                                                                                     PMD to be used for static analysis

EXAMPLES
  $ sfdx sfpowerscripts:analyze:pmd -b

  Output variable:
  sfpowerscripts_pmd_output_path
  <refname>_sfpowerscripts_pmd_output_path
```

_See code:_ [_commands/sfpowerscripts/analyze/pmd.ts_](https://github.com/Accenture/sfpowerscripts/tree/develop/packages/sfpowerscripts-cli/src/commands/sfpowerscripts/analyze/pmd.ts)

## `sfdx sfpowerscripts:apextests:trigger`

Triggers Apex unit test in an org. Supports test level RunAllTestsInPackage, which optionally allows validation of individual class code coverage

```text
Triggers Apex unit test in an org. Supports test level RunAllTestsInPackage, which optionally allows validation of individual class code coverage

USAGE
  $ sfdx sfpowerscripts:apextests:trigger [-u <string>] [-l <string>] [-n <string>] [-c] [--validatepackagecoverage]
  [-s] [--specifiedtests <string>] [--apextestsuite <string>] [-p <integer>] [--waittime <string>] [--json] [--loglevel
  trace|debug|info|warn|error|fatal|TRACE|DEBUG|INFO|WARN|ERROR|FATAL]

OPTIONS
  -c, --validateindividualclasscoverage
      Validate that individual classes have a coverage greater than the minimum required percentage coverage, only
      available when test level is RunAllTestsInPackage

  -l, --testlevel=RunSpecifiedTests|RunApexTestSuite|RunLocalTests|RunAllTestsInOrg|RunAllTestsInPackage
      [default: RunLocalTests] The test level of the test that need to be executed when the code is to be deployed

  -n, --package=package
      Name of the package to run tests. Required when test level is RunAllTestsInPackage

  -p, --coveragepercent=coveragepercent
      [default: 75] Minimum required percentage coverage, when validating code coverage

  -s, --synchronous
      Select an option if the tests are to be run synchronously

  -u, --targetorg=targetorg
      [default: scratchorg] username or alias for the target org; overrides default target org

  --apextestsuite=apextestsuite
      comma-separated list of Apex test suite names to run

  --json
      format output as json

  --loglevel=(trace|debug|info|warn|error|fatal|TRACE|DEBUG|INFO|WARN|ERROR|FATAL)
      [default: warn] logging level for this command invocation

  --specifiedtests=specifiedtests
      comma-separated list of Apex test class names or IDs and, if applicable, test methods to run

  --validatepackagecoverage
      Validate that the package coverage is greater than the minimum required percentage coverage, only available when
      test level is RunAllTestsInPackage

  --waittime=waittime
      [default: 60] wait time for command to finish in minutes

EXAMPLES
  $ sfdx sfpowerscripts:apextests:trigger -u scratchorg -l RunLocalTests -s
  $ sfdx sfpowerscripts:apextests:trigger -u scratchorg -l RunAllTestsInPackage -n <mypackage> -c
```

_See code:_ [_commands/sfpowerscripts/apextests/trigger.ts_](https://github.com/Accenture/sfpowerscripts/tree/develop/packages/sfpowerscripts-cli/src/commands/sfpowerscripts/apextests/trigger.ts)

## `sfdx sfpowerscripts:apextests:validate`

Validates apex test coverage in the org, Please ensure that the SFDX CLI and sfpowerkit plugin are installed before using this task.

```text
Validates apex test coverage in the org, Please ensure that the SFDX CLI and sfpowerkit plugin are installed before using this task.

USAGE
  $ sfdx sfpowerscripts:apextests:validate -t <string> [-u <string>] [--json] [--loglevel
  trace|debug|info|warn|error|fatal|TRACE|DEBUG|INFO|WARN|ERROR|FATAL]

OPTIONS
  -t, --testcoverage=testcoverage                                                   (required) The percentage of test
                                                                                    coverage for apex clasess, that
                                                                                    should be as per the last test run
                                                                                    status

  -u, --targetorg=targetorg                                                         [default: scratchorg] Alias or
                                                                                    username of the target org

  --json                                                                            format output as json

  --loglevel=(trace|debug|info|warn|error|fatal|TRACE|DEBUG|INFO|WARN|ERROR|FATAL)  [default: warn] logging level for
                                                                                    this command invocation

EXAMPLE
  $ sfdx sfpowerscripts:apextests:validate -u scratchorg -t 80
```

_See code:_ [_commands/sfpowerscripts/apextests/validate.ts_](https://github.com/Accenture/sfpowerscripts/tree/develop/packages/sfpowerscripts-cli/src/commands/sfpowerscripts/apextests/validate.ts)

## `sfdx sfpowerscripts:package:data:create`

Creates a versioned artifact from a source directory containing SFDMU-based data \(in csv format and export json\). The artifact can be consumed by release pipelines, to deploy the data to orgs

```text
Creates a versioned artifact from a source directory containing SFDMU-based data (in csv format and export json). The artifact can be consumed by release pipelines, to deploy the data to orgs

USAGE
  $ sfdx sfpowerscripts:package:data:create -n <string> -v <string> [--artifactdir <directory>] [--diffcheck] [--branch
  <string>] [--gittag] [-r <string>] [--refname <string>]

OPTIONS
  -n, --package=package
      (required) The name of the package

  -r, --repourl=repourl
      Custom source repository URL to use in artifact metadata, overrides origin URL defined in git config

  -v, --versionnumber=versionnumber
      (required) The format is major.minor.patch.buildnumber . This will override the build number mentioned in the
      sfdx-project.json, Try considering the use of Increment Version Number task before this task

  --artifactdir=artifactdir
      [default: artifacts] The directory where the artifact is to be written

  --branch=branch
      The git branch that this build is triggered on, Useful for metrics and general identification purposes

  --diffcheck
      Only build when the package has changed

  --gittag
      Tag the current commit ID with an annotated tag containing the package name and version - does not push tag

  --refname=refname
      Reference name to be prefixed to output variables

EXAMPLES
  $ sfdx sfpowerscripts:package:data:create -n mypackage -v <version>
  $ sfdx sfpowerscripts:package:data:create -n <mypackage> -v <version> --diffcheck --gittag
  Output variable:
  sfpowerscripts_artifact_directory
  <refname>_sfpowerscripts_artifact_directory
  sfpowerscripts_package_version_number
  <refname>_sfpowerscripts_package_version_number
```

_See code:_ [_commands/sfpowerscripts/package/data/create.ts_](https://github.com/Accenture/sfpowerscripts/tree/develop/packages/sfpowerscripts-cli/src/commands/sfpowerscripts/package/data/create.ts)

## `sfdx sfpowerscripts:package:data:install`

Installs a SFDMU-based data package consisting of csvfiles and export.json to a target org

```text
Installs a SFDMU-based data package consisting of csvfiles and export.json to a target org

USAGE
  $ sfdx sfpowerscripts:package:data:install -n <string> -u <string> [--artifactdir <directory>] [-s]
  [--skipifalreadyinstalled] [--subdirectory <directory>]

OPTIONS
  -n, --package=package                                                             (required) Name of the package to be
                                                                                    installed

  -s, --skiponmissingartifact                                                       Skip package installation if the
                                                                                    build artifact is missing. Enable
                                                                                    this if artifacts are only being
                                                                                    created for modified packages

  -u, --targetorg=targetorg                                                         (required) Alias/User Name of the
                                                                                    target environment

  --artifactdir=artifactdir                                                         [default: artifacts] The directory
                                                                                    where the artifact is located

  --skipifalreadyinstalled                                                          Skip the package installation if the
                                                                                    package is already installed in the
                                                                                    org

  --subdirectory=subdirectory                                                       Install specific subdirectory in the
                                                                                    package. Useful when package
                                                                                    consists of multiple discrete
                                                                                    sub-packages

EXAMPLE
  $ sfdx sfpowerscripts:package:data:install -n mypackage -u <org>
```

_See code:_ [_commands/sfpowerscripts/package/data/install.ts_](https://github.com/Accenture/sfpowerscripts/tree/develop/packages/sfpowerscripts-cli/src/commands/sfpowerscripts/package/data/install.ts)

## `sfdx sfpowerscripts:package:source:create`

This task simulates a packaging experience similar to unlocked packaging - creating an artifact that consists of the metadata wrapped into an artifact. The artifact can then be consumed by release tasks, to deploy the package

```text
This task simulates a packaging experience similar to unlocked packaging - creating an artifact that consists of the metadata (e.g. commit Id), source code & an optional destructive manifest. The artifact can then be consumed by release pipelines, to deploy the package

USAGE
  $ sfdx sfpowerscripts:package:source:create -n <string> -v <string> [--artifactdir <directory>] [--diffcheck]
  [--branch <string>] [--gittag] [-r <string>] [--refname <string>]

OPTIONS
  -n, --package=package
      (required) The name of the package

  -r, --repourl=repourl
      Custom source repository URL to use in artifact metadata, overrides origin URL defined in git config

  -v, --versionnumber=versionnumber
      (required) The format is major.minor.patch.buildnumber . This will override the build number mentioned in the
      sfdx-project.json, Try considering the use of Increment Version Number task before this task

  --artifactdir=artifactdir
      [default: artifacts] The directory where the artifact is to be written

  --branch=branch
      The git branch that this build is triggered on, Useful for metrics and general identification purposes

  --diffcheck
      Only build when the package has changed

  --gittag
      Tag the current commit ID with an annotated tag containing the package name and version - does not push tag

  --refname=refname
      Reference name to be prefixed to output variables

EXAMPLES
  $ sfdx sfpowerscripts:package:source:create -n mypackage -v <version>
  $ sfdx sfpowerscripts:package:source:create -n <mypackage> -v <version> --diffcheck --gittag
  Output variable:
  sfpowerscripts_artifact_metadata_directory
  <refname>_sfpowerscripts_artifact_metadata_directory
  sfpowerscripts_artifact_directory
  <refname>_sfpowerscripts_artifact_directory
  sfpowerscripts_package_version_number
  <refname>_sfpowerscripts_package_version_number
```

_See code:_ [_commands/sfpowerscripts/package/source/create.ts_](https://github.com/Accenture/sfpowerscripts/tree/develop/packages/sfpowerscripts-cli/src/commands/sfpowerscripts/package/source/create.ts)

## `sfdx sfpowerscripts:package:source:install`

Installs a sfpowerscripts source package to the target org. skipifalreadyinstalled\` only works provide the target org has sfpowerscripts-artifact' \(04t1P000000ka9mQAA\) installed. Please note you can deploy your own instance of 'sfpowerscripts-artifact' by building it from the repo and overriding using the environment variable SFPOWERSCRIPTS\_ARTIFACT\_UNLOCKED\_PACKAGE

```text
Installs a sfpowerscripts source package to the target org

USAGE
  $ sfdx sfpowerscripts:package:source:install -n <string> -u <string> [--artifactdir <directory>]
  [--skipifalreadyinstalled] [-s] [--subdirectory <directory>] [-o] [-t] [--waittime <string>] [--refname <string>]

OPTIONS
  -n, --package=package                                                             (required) Name of the package to be
                                                                                    installed

  -o, --optimizedeployment                                                          Optimize deployment by triggering
                                                                                    test classes that are in the
                                                                                    package, rather than using the whole
                                                                                    tests in the org

  -s, --skiponmissingartifact                                                       Skip package installation if the
                                                                                    build artifact is missing. Enable
                                                                                    this if artifacts are only being
                                                                                    created for modified packages

  -t, --skiptesting                                                                 Skips running test when deploying to
                                                                                    a sandbox

  -u, --targetorg=targetorg                                                         (required) Alias/User Name of the
                                                                                    target environment

  --artifactdir=artifactdir                                                         [default: artifacts] The directory
                                                                                    where the artifact is located


  --refname=refname                                                                 Reference name to be prefixed to
                                                                                    output variables

  --skipifalreadyinstalled                                                          Skip the package installation if the
                                                                                    package is already installed in the
                                                                                    org

  --subdirectory=subdirectory                                                       Install specific subdirectory in the
                                                                                    package. Useful when package
                                                                                    consists of multiple discrete
                                                                                    sub-packages

  --waittime=waittime                                                               [default: 120] wait time for command
                                                                                    to finish in minutes

EXAMPLE
  $ sfdx sfpowerscripts:package:source:install -n mypackage -u <org>
```

_See code:_ [_commands/sfpowerscripts/package/source/install.ts_](https://github.com/Accenture/sfpowerscripts/tree/develop/packages/sfpowerscripts-cli/src/commands/sfpowerscripts/package/source/install.ts)

## `sfdx sfpowerscripts:package:unlocked:create`

Creates a new package version, and generates an artifact that consists of the metadata \(e.g. version Id\). The artifact can then be consumed by release pipelines, to install the unlocked package. Utilize this task in a package build for DX Unlocked Package

```text
Creates a new package version, and generates an artifact that consists of the metadata (e.g. version Id). The artifact can then be consumed by release pipelines, to install the unlocked package. Utilize this task in a package build for DX Unlocked Package

USAGE
  $ sfdx sfpowerscripts:package:unlocked:create -n <string> [-b] [-k <string> | -x] [--diffcheck] [--gittag] [-r
  <string>] [--versionnumber <string>] [-f <filepath>] [--artifactdir <directory>] [--enablecoverage] [-s] [--branch
  <string>] [--tag <string>] [--waittime <string>] [--refname <string>] [-v <string>] [--apiversion <string>]

OPTIONS
  -b, --buildartifactenabled
      [DEPRECATED - always generate artifact] Create a build artifact, so that this pipeline can be consumed by a release
      pipeline

  -f, --configfilepath=configfilepath
      [default: config/project-scratch-def.json] Path in the current project directory containing  config file for the
      packaging org

  -k, --installationkey=installationkey
      Installation key for this package

  -n, --package=package
      (required) ID (starts with 0Ho) or alias of the package to create a version of

  -r, --repourl=repourl
      Custom source repository URL to use in artifact metadata, overrides origin URL defined in git config

  -s, --isvalidationtobeskipped
      Skips validation of dependencies, package ancestors, and metadata during package version creation. Skipping
      validation reduces the time it takes to create a new package version, but package versions created without
      validation can’t be promoted.

  -v, --targetdevhubusername=targetdevhubusername
      username or alias for the dev hub org; overrides default dev hub org

  -x, --installationkeybypass
      Bypass the requirement for having an installation key for this version of the package

  --apiversion=apiversion
      override the api version used for api requests made by this command

  --artifactdir=artifactdir
      [default: artifacts] The directory where the artifact is to be written

  --branch=branch
      The git branch that this build is triggered on, Useful for metrics and general identification purposes

  --diffcheck
      Only build when the package has changed

  --enablecoverage
      Please note this command takes a longer time to compute, activating this on every packaging build might not
      necessary

  --gittag
      Tag the current commit ID with an annotated tag containing the package name and version - does not push tag


  --refname=refname
      Reference name to be prefixed to output variables

  --tag=tag
      the package version's tag

  --versionnumber=versionnumber
      The format is major.minor.patch.buildnumber . This will override the build number mentioned in the
      sfdx-project.json, Try considering the use of Increment Version Number task before this task

  --waittime=waittime
      [default: 120] wait time for command to finish in minutes

EXAMPLES
  $ sfdx sfpowerscripts:package:unlocked:create -n <packagealias> -b -x -v <devhubalias> --refname <name>
  $ sfdx sfpowerscripts:package:unlocked:create -n <packagealias> -b -x -v <devhubalias> --diffcheck --gittag

  Output variable:
  sfpowerscripts_package_version_id
  <refname>_sfpowerscripts_package_version_id
  sfpowerscripts_artifact_metadata_directory
  <refname>_sfpowerscripts_artifact_metadata_directory
  sfpowerscripts_artifact_directory
  <refname>_sfpowerscripts_artifact_directory
  sfpowerscripts_package_version_number
  <refname>_sfpowerscripts_package_version_number
```

_See code:_ [_commands/sfpowerscripts/package/unlocked/create.ts_](https://github.com/Accenture/sfpowerscripts/tree/develop/packages/sfpowerscripts-cli/src/commands/sfpowerscripts/package/unlocked/create.ts)

## `sfdx sfpowerscripts:package:unlocked:install`

Installs an unlocked package using sfpowerscripts metadata

```text
Installs an unlocked package using sfpowerscripts metadata

USAGE
  $ sfdx sfpowerscripts:package:unlocked:install [-n <string>] [-u <string>] [-v <string> | -i] [-k <string>] [-a]
  [--artifactdir <directory>] [--securitytype <string>] [-f] [-s undefined] [--upgradetype <string>] [--waittime
  <string>] [--publishwaittime <string>] [--json] [--loglevel
  trace|debug|info|warn|error|fatal|TRACE|DEBUG|INFO|WARN|ERROR|FATAL]

OPTIONS
  -a, --apexcompileonlypackage                                                      Each package installation triggers a
                                                                                    compilation of apex, flag to trigger
                                                                                    compilation of package only

  -f, --skipifalreadyinstalled                                                      Skip the package installation if the
                                                                                    package is already installed in the
                                                                                    org

  -i, --packageinstalledfrom                                                        automatically retrieve the version
                                                                                    ID of the package to be installed,
                                                                                    from the build artifact

  -k, --installationkey=installationkey                                             installation key for key-protected
                                                                                    package

  -n, --package=package                                                             Name of the package to be installed

  -s, --skiponmissingartifact                                                       Skip package installation if the
                                                                                    build artifact is missing. Enable
                                                                                    this if artifacts are only being
                                                                                    created for modified packages

  -u, --targetorg=targetorg                                                         Alias/User Name of the target
                                                                                    environment

  -v, --packageversionid=packageversionid                                           manually input package version Id of
                                                                                    the package to be installed

  --artifactdir=artifactdir                                                         [default: artifacts] The directory
                                                                                    where the artifact is located

  --publishwaittime=publishwaittime                                                 [default: 10] number of minutes to
                                                                                    wait for subscriber package version
                                                                                    ID to become available in the target
                                                                                    org

  --securitytype=AllUsers|AdminsOnly                                                [default: AllUsers] Select the
                                                                                    security access for the package
                                                                                    installation

  --upgradetype=DeprecateOnly|Mixed|Delete                                          [default: Mixed] the upgrade type
                                                                                    for the package installation

  --waittime=waittime                                                               [default: 120] wait time for command
                                                                                    to finish in minutes

EXAMPLE
  $ sfdx sfpowerscripts:package:unlocked:install -n packagename -u sandboxalias -i
```

_See code:_ [_commands/sfpowerscripts/package/unlocked/install.ts_](https://github.com/Accenture/sfpowerscripts/tree/develop/packages/sfpowerscripts-cli/src/commands/sfpowerscripts/package/unlocked/install.ts)

## `sfdx sfpowerscripts:package:version:increment`

Increment the selected version counter by one and optionally commit changes to sfdx-project.json. This command does not push changes to the source repository

```text
Increment the selected version counter by one and optionally commit changes to sfdx-project.json. This command does not push changes to the source repository

USAGE
  $ sfdx sfpowerscripts:package:version:increment [--segment <string>] [-a -r <string>] [-n <string>] [-d <string>]
  [-c] [--refname <string>]

OPTIONS
  -a, --appendbuildnumber
      Set the build segment of the version number to the build number rather than incremenenting

  -c, --commitchanges
      Mark this if you want to commit the modified sfdx-project json, Please note this will not push to the repo only
      commits in the local checked out repo, You would need to have a push to the repo at the end of the packaging task if
      everything is successfull

  -d, --projectdir=projectdir
      The directory should contain a sfdx-project.json for this command to succeed

  -n, --package=package
      The name of the package of which the version need to be incremented,If not specified the default package is utilized

  -r, --runnumber=runnumber
      The build number of the CI pipeline, usually available through an environment variable

  --refname=refname
      Reference name to be prefixed to output variables

  --segment=Major|Minor|Patch|BuildNumber
      [default: BuildNumber] Select the segment of the version

EXAMPLES
  $ sfdx sfpowerscripts:package:version:increment --segment BuildNumber -n packagename -c

  Output variable:
  sfpowerscripts_incremented_project_version
  <refname>_sfpowerscripts_incremented_project_version
```

_See code:_ [_commands/sfpowerscripts/package/version/increment.ts_](https://github.com/Accenture/sfpowerscripts/tree/develop/packages/sfpowerscripts-cli/src/commands/sfpowerscripts/package/version/increment.ts)

## `sfdx sfpowerscripts:pool:delete`

Deletes the pooled scratch orgs from the Scratch Org Pool

```text
Deletes the pooled scratch orgs from the Scratch Org Pool

USAGE
  $ sfdx sfpowerscripts:pool:delete -t <string> [-m] [-i | -a] [-v <string>] [--apiversion <string>] [--json]
  [--loglevel trace|debug|info|warn|error|fatal|TRACE|DEBUG|INFO|WARN|ERROR|FATAL]

OPTIONS
  -a, --allscratchorgs                                                              Deletes all used and unused Scratch
                                                                                    orgs from pool by the tag

  -i, --inprogressonly                                                              Deletes all In Progress Scratch orgs
                                                                                    from pool by the tag

  -m, --mypool                                                                      Filter only Scratch orgs created by
                                                                                    current user in the pool

  -t, --tag=tag                                                                     (required) tag used to identify the
                                                                                    scratch org pool

  -v, --targetdevhubusername=targetdevhubusername                                   username or alias for the dev hub
                                                                                    org; overrides default dev hub org

  --apiversion=apiversion                                                           override the api version used for
                                                                                    api requests made by this command

EXAMPLES
  $ sfdx sfpowerscripts:pool:delete -t core
  $ sfdx sfpowerscripts:pool:delete -t core -v devhub
```

_See code:_ [_commands/sfpowerscripts/pool/delete.ts_](https://github.com/Accenture/sfpowerscripts/tree/develop/packages/sfpowerscripts-cli/src/commands/sfpowerscripts/pool/delete.ts)

## `sfdx sfpowerscripts:pool:fetch`

Gets an active/unused scratch org from the scratch org pool

```text
Gets an active/unused scratch org from the scratch org pool

USAGE
  $ sfdx sfpowerscripts:pool:fetch -t <string> [-v <string>] [--apiversion <string>]
OPTIONS
  -t, --tag=tag                                                                     (required) (required) tag used to
                                                                                    identify the scratch org pool

  -v, --targetdevhubusername=targetdevhubusername                                   username or alias for the dev hub
                                                                                    org; overrides default dev hub org

  --apiversion=apiversion                                                           override the api version used for
                                                                                    api requests made by this command



EXAMPLES
  $ sfdx sfpowerkit:pool:fetch -t core
  $ sfdx sfpowerkit:pool:fetch -t core -v devhub
  $ sfdx sfpowerkit:pool:fetch -t core -v devhub -m
  $ sfdx sfpowerkit:pool:fetch -t core -v devhub -s testuser@test.com
```

_See code:_ [_commands/sfpowerscripts/pool/fetch.ts_](https://github.com/Accenture/sfpowerscripts/tree/develop/packages/sfpowerscripts-cli/src/commands/sfpowerscripts/pool/fetch.ts)

## `sfdx sfpowerscripts:pool:list`

Retrieves a list of active scratch org and details from any pool. If this command is run with -m\|--mypool, the command will retrieve the passwords for the pool created by the user who is executing the command.

```text
Retrieves a list of active scratch org and details from any pool. If this command is run with -m|--mypool, the command will retrieve the passwords for the pool created by the user who is executing the command.

USAGE
  $ sfdx sfpowerscripts:pool:list [-t <string>] [-m] [-a] [-v <string>] [--apiversion <string>]
OPTIONS
  -a, --allscratchorgs                                                              Gets all used and unused Scratch
                                                                                    orgs from pool

  -m, --mypool                                                                      Filter the tag for any additions
                                                                                    created  by the executor of the
                                                                                    command

  -t, --tag=tag                                                                     tag used to identify the scratch org
                                                                                    pool

  -v, --targetdevhubusername=targetdevhubusername                                   username or alias for the dev hub
                                                                                    org; overrides default dev hub org

  --apiversion=apiversion                                                           override the api version used for
                                                                                    api requests made by this command

EXAMPLES
  $ sfdx sfpowerscripts:pool:list -t core
  $ sfdx sfpowerscripts:pool:list -t core -v devhub
  $ sfdx sfpowerscripts:pool:list -t core -v devhub -m
  $ sfdx sfpowerscripts:pool:list -t core -v devhub -m -a
```

_See code:_ [_commands/sfpowerscripts/pool/list.ts_](https://github.com/Accenture/sfpowerscripts/tree/develop/packages/sfpowerscripts-cli/src/commands/sfpowerscripts/pool/list.ts)\`\`

## `sfdx sfpowerscripts:artifacts:fetch`

```text
Fetch artifacts from an artifact registry that is either NPM compatible or supports universal artifacts

USAGE
  $ sfdx sfpowerscripts:artifacts:fetch -d <directory> [-p <filepath>] [--scope <string> [--npm | -f <filepath>]] [--npmrcpath <filepath> undefined] [--json]
  [--loglevel trace|debug|info|warn|error|fatal|TRACE|DEBUG|INFO|WARN|ERROR|FATAL]

OPTIONS
  -d, --artifactdir=artifactdir                                                     (required) [default: artifacts] Directory
                                                                                    to save downloaded artifacts

  -f, --scriptpath=scriptpath                                                       (Optional: no-NPM)Path to script that
                                                                                    authenticates and downloads artifacts
                                                                                    from the registry

  -p, --releasedefinition=releasedefinition                                         Path to YAML file containing map of
                                                                                    packages and package versions to
                                                                                    download

  --json                                                                            format output as json

  --loglevel=(trace|debug|info|warn|error|fatal|TRACE|DEBUG|INFO|WARN|ERROR|FATAL)  [default: warn] logging level for this
                                                                                    command invocation

  --npm                                                                             Download artifacts from a pre-authenticated
                                                                                    private npm registry

  --npmrcpath=npmrcpath                                                             Path to .npmrc file used for authentication
                                                                                    to registry. If left blank, defaults to
                                                                                    home directory

  --scope=scope                                                                     (required for NPM) User or Organisation
                                                                                    scope of the NPM package

EXAMPLES
  $ sfdx sfpowerscripts:artifacts:fetch -p myreleasedefinition.yaml -f myscript.sh
  $ sfdx sfpowerscripts:artifacts:fetch -p myreleasedefinition.yaml --npm --scope myscope --npmrcpath path/to/.npmrc
```

_See code:_ [_commands/sfpowerscripts/artifacts/fetch.ts_](https://github.com/Accenture/sfpowerscripts/tree/develop/packages/sfpowerscripts-cli/src/commands/sfpowerscripts/artifacts/fetch.ts)

