# sfpowerscripts

An opinionated Salesforce build system (statsd metrics enabled) as a sfdx plugin that can be implemented in any CI/CD system of choice

- Features
  - Orchestrator, which utilizes sfdx-project.json as the source of truth for driving the build system, ensuring very low maintenance on programs often dealing with multiple number of packages
  - Builds packages in parallel by respecting dependencies
  - Ability to selectively build changed packages in a mono repo
  - Ability to deploy only packages that are changed in repo
  - Pooling commands to prepare a pool of scratch org's with pacakges pre installed for optimized Pull/Merge Request validation 
  - Artifacts Driven,  all create commands produce an artifact or operate on an artifact 
  - Integrate with any CI/CD system of choice
  - Support for external scripts, as hooks making integration easy 

## Installation

The [SFDX CLI](https://developer.salesforce.com/docs/atlas.en-us.sfdx_setup.meta/sfdx_setup/sfdx_setup_install_cli.htm), [sfpowerkit plugin](https://github.com/Accenture/sfpowerkit), and  [sfdmu]()  are required for this plugin to work. If you have not already done so, please install both of these before continuing.

To install the sfpowerscripts plugin, run the following command:
```
$ sfdx plugins:install sfpowerkit
$ sfdx plugins:install sfdmu
$ sfdx plugins:install @dxatscale/sfpowerscripts
```
For automated installations as part of a CI process or Dockerfile:
```
$ echo 'y' | sfdx plugins:install @dxatscale/sfpowerscripts
```
  <!-- usage -->
```sh-session
$ npm install -g @dxatscale/sfpowerscripts
$ sfdx COMMAND
running command...
$ sfdx (-v|--version|version)
@dxatscale/sfpowerscripts/1.4.5 win32-x64 node-v12.16.3
$ sfdx --help [COMMAND]
USAGE
  $ sfdx COMMAND
...
```
<!-- usagestop -->


## Output variables

Many of the commands listed below will output variables which may be consumed as flag inputs in subsequent commands. Simply pass the **variable name** to the command, and it will be substituted with the corresponding value, at runtime.

Eg.
```
  $ sfdx sfpowerscripts:package:incrementBuildNumber -n <mypackage>

    ...

    Output variable:
    sfpowerscripts_incremented_project_version=1.0.0.1

  $ sfdx sfpowerscripts:package:source:create -n <mypackage> --versionnumber sfpowerscripts_incremented_project_version
```

The following output variables are currently supported:

* sfpowerscripts_incremented_project_version
* sfpowerscripts_artifact_directory
* sfpowerscripts_artifact_metadata_directory
* sfpowerscripts_delta_package_path
* sfpowerscripts_package_version_id
* sfpowerscripts_package_version_number
* sfpowerscripts_pmd_output_path
* sfpowerkit_deploysource_id

If you require access to the variables at the shell layer, you may do so using the [readVars](https://github.com/Accenture/sfpowerscripts/tree/develop/packages/sfpowerscripts-cli/scripts) helper script, which is included as part of this package.


### Reference name

Commands that output variables optionally accept a `--refname` flag that prefixes output variables with a user-specified string. The prefix is intended as a variable namespace that allows the same command to be invoked multiple times without overwriting the output variables.

```
$ sfdx sfpowerscripts:package:unlocked:create --refname core -n core_package -b -x -v DevHub

Output variables:
core_sfpowerscripts_package_version_id=04t2v000007X2YRAA0

$ sfdx sfpowerscripts:CreateUnlockedPackage --refname utility -n utility_package -b -x -v Devhub

Output variables:
utility_sfpowerscripts_package_version_id=04t2v000007X2YWAA0
```


<!-- usagestop -->
  ## Commands
  <!-- commands -->
 - Orchestrator Commands 
   - [`sfdx sfpowerscripts:orchestrator:prepare`](#sfdx-sfpowerscriptsorchestratorprepare)
   - [`sfdx sfpowerscripts:orchestrator:analyze`](#sfdx-sfpowerscriptsorchestratoranalyze)
   - [`sfdx sfpowerscripts:orchestrator:validate`](#sfdx-sfpowerscriptsorchestratorvalidate)
   - [`sfdx sfpowerscripts:orchestrator:quickbuild`](#sfdx-sfpowerscriptsorchestratorquickbuild)
   - [`sfdx sfpowerscripts:orchestrator:build`](#sfdx-sfpowerscriptsorchestratorbuild)
   - [`sfdx sfpowerscripts:orchestrator:deploy`](#sfdx-sfpowerscriptsorchestratordeploy) 
   - [`sfdx sfpowerscripts:orchestrator:promote`](#sfdx-sfpowerscriptsorchestratorpromote)
   - [`sfdx sfpowerscripts:orchestrator:publish`](#sfdx-sfpowerscriptsorchestratorpublish)

- Changelog (Track Releases)
   - [`sfdx sfpowerscripts:changelog:generate`](#sfdx-sfpowerscriptschangeloggenerate)

 - Package Commands ( Build your own workflow)
	 - [`sfdx sfpowerscripts:package:data:create`](#sfdx-sfpowerscriptspackagedatacreate)
	 - [`sfdx sfpowerscripts:package:data:install`](#sfdx-sfpowerscriptspackagedatainstall)
	 - [`sfdx sfpowerscripts:package:delta:create`](#sfdx-sfpowerscriptspackagedeltacreate)
	 - [`sfdx sfpowerscripts:package:incrementBuildNumber`](#sfdx-sfpowerscriptspackageincrementbuildnumber)
	 - [`sfdx sfpowerscripts:package:source:create`](#sfdx-sfpowerscriptspackagesourcecreate)
	 - [`sfdx sfpowerscripts:package:source:install`](#sfdx-sfpowerscriptspackagesourceinstall)
	 - [`sfdx sfpowerscripts:package:unlocked:create`](#sfdx-sfpowerscriptspackageunlockedcreate)
	 - [`sfdx sfpowerscripts:package:unlocked:install`](#sfdx-sfpowerscriptspackageunlockedinstall)
	 - [`sfdx sfpowerscripts:source:deploy`](#sfdx-sfpowerscriptssourcedeploy)
	 - [`sfdx sfpowerscripts:source:deployDestructiveManifest`](#sfdx-sfpowerscriptssourcedeploydestructivemanifest-)

 - Pool Management
	 - [`sfdx sfpowerscripts:pool:delete `](#sfdx-sfpowerscriptspooldelete)
	 - [`sfdx sfpowerscripts:pool:fetch`](#sfdx-sfpowerscriptspoolfetch)
	 - [`sfdx sfpowerscripts:pool:list`](#sfdx-sfpowerscriptspoollist)

 - Static Analysis
	 - [`sfdx sfpowerscripts:analyze:pmd`](#sfdx-sfpowerscriptsanalyzepmd)
	 
- Apex tests
  - [`sfdx sfpowerscripts:apextests:trigger`](#sfdx-sfpowerscriptsapexteststrigger)
  - [`sfdx sfpowerscripts:apextests:validate`](#sfdx-sfpowerscriptsapextestsvalidate)


## `sfdx sfpowerscripts:orchestrator:prepare`

Prepare a pool of scratchorgs with all the packages upfront, so that any incoming change can be validated in an optimized manner

```
Prepare a pool of scratchorgs with all the packages upfront, so that any incoming change can be validated in an optimized manner

USAGE
  $ sfdx sfpowerscripts:orchestrator:prepare -t <string> [-e <number>] [-m <number>] [-f <filepath>] 
  [--installassourcepackages --installall] [-s <filepath>] [--succeedondeploymenterrors] [--keys <string>] [-v <string>] 
  [--apiversion <string>] [--json] [--loglevel trace|debug|info|warn|error|fatal|TRACE|DEBUG|INFO|WARN|ERROR|FATAL]

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
                                                                                    all the packages in the repo as
                                                                                    source packages to the org, thus
                                                                                    reducing  time spent on validation

  --installassourcepackages                                                         By default, all the
                                                                                    packages(excluding data) are
                                                                                    installed as source packages,
                                                                                    override this flag to install the
                                                                                    packages as it is

  --json                                                                            format output as json

  --keys=keys                                                                       Keys to be used while installing any
                                                                                    managed package dependent

  --loglevel=(trace|debug|info|warn|error|fatal|TRACE|DEBUG|INFO|WARN|ERROR|FATAL)  [default: warn] logging level for
                                                                                    this command invocation

  --succeedondeploymenterrors                                                       Do not fail the scratch orgs, if a
                                                                                    package failed to deploy, return the
                                                                                    scratch org with packages till the
                                                                                    last failure

EXAMPLE
  $ sfdx sfpowerscripts:orchestrator:prepare -t CI_1  -v <devhub>
```

_See code: [lib/commands/sfpowerscripts/orchestrator/prepare.js](https://github.com/Accenture/sfpowerscripts/blob/v1.4.5/lib/commands/sfpowerscripts/orchestrator/prepare.js)_
## `sfdx sfpowerscripts:orchestrator:analyze`

Runs static analysis on the code/config based on configurable rules

```
Runs static analysis on the code/config based on configurable rules

USAGE
  $ sfdx sfpowerscripts:orchestrator:analyze [--json] [--loglevel 
  trace|debug|info|warn|error|fatal|TRACE|DEBUG|INFO|WARN|ERROR|FATAL]

OPTIONS
  --json                                                                            format output as json

  --loglevel=(trace|debug|info|warn|error|fatal|TRACE|DEBUG|INFO|WARN|ERROR|FATAL)  [default: warn] logging level for
                                                                                    this command invocation

EXAMPLE
  $ sfdx sfpowerscripts:orchestrator:validate -u <scratchorg> -v <devhub>
```

_See code: [lib/commands/sfpowerscripts/orchestrator/analyze.js](https://github.com/Accenture/sfpowerscripts/blob/v1.4.5/lib/commands/sfpowerscripts/orchestrator/analyze.js)_

## `sfdx sfpowerscripts:orchestrator:validate`

Validate the incoming change against an earlier prepared scratchorg

```
Validate the incoming change against an earlier prepared scratchorg

USAGE
  $ sfdx sfpowerscripts:orchestrator:validate -u <string> -p <array> -f <filepath> -i <string> [--shapefile <string>] 
  [--coveragepercent <integer>] [-g <array>] [-x] [--json] [--loglevel 
  trace|debug|info|warn|error|fatal|TRACE|DEBUG|INFO|WARN|ERROR|FATAL]

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

  --json                                                                            format output as json

  --loglevel=(trace|debug|info|warn|error|fatal|TRACE|DEBUG|INFO|WARN|ERROR|FATAL)  [default: warn] logging level for
                                                                                    this command invocation

  --shapefile=shapefile                                                             Path to .zip file of scratch org
                                                                                    shape / metadata to deploy

EXAMPLE
  $ sfdx sfpowerscripts:orchestrator:validate -p "POOL_TAG_1,POOL_TAG_2" -u <devHubUsername> -i <clientId> -f <jwt_file>
```

_See code: [lib/commands/sfpowerscripts/orchestrator/validate.js](https://github.com/Accenture/sfpowerscripts/blob/v1.4.5/lib/commands/sfpowerscripts/orchestrator/validate.js)_
## `sfdx sfpowerscripts:orchestrator:quickbuild`

Build all packages (unlocked/source/data) in a repo in parallel, respecting the dependency of each packages and generate artifacts to a provided directory without validating individual dependencies

```
Build all packages (unlocked/source/data) in a repo in parallel, respecting the dependency of each packages and generate artifacts to a provided directory without validating individual dependencies

USAGE
  $ sfdx sfpowerscripts:orchestrator:quickbuild [--diffcheck] [--gittag] [-r <string>] [-f <filepath>] [--artifactdir 
  <directory>] [--waittime <number>] [--buildnumber <number>] [--executorcount <number>] [--branch <string>] [--tag 
  <string>] [-v <string>] [--apiversion <string>] [--json] [--loglevel 
  trace|debug|info|warn|error|fatal|TRACE|DEBUG|INFO|WARN|ERROR|FATAL]

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

  --json                                                                            format output as json

  --loglevel=(trace|debug|info|warn|error|fatal|TRACE|DEBUG|INFO|WARN|ERROR|FATAL)  [default: warn] logging level for
                                                                                    this command invocation

  --tag=tag                                                                         Tag the build with a label, useful
                                                                                    to identify in metrics

  --waittime=waittime                                                               [default: 120] Wait time for command
                                                                                    to finish in minutes
```

_See code: [lib/commands/sfpowerscripts/orchestrator/quickbuild.js](https://github.com/Accenture/sfpowerscripts/blob/v1.4.5/lib/commands/sfpowerscripts/orchestrator/quickbuild.js)_


## `sfdx sfpowerscripts:orchestrator:build`

Build all packages (unlocked/source/data) in a repo in parallel, respecting the dependency of each packages and generate artifacts to a provided directory

```
Build all packages (unlocked/source/data) in a repo in parallel, respecting the dependency of each packages and generate artifacts to a provided directory

USAGE
  $ sfdx sfpowerscripts:orchestrator:build [--diffcheck] [--gittag] [-r <string>] [-f <filepath>] [--artifactdir 
  <directory>] [--waittime <number>] [--buildnumber <number>] [--executorcount <number>] [--branch <string>] [--tag 
  <string>] [-v <string>] [--apiversion <string>] [--json] [--loglevel 
  trace|debug|info|warn|error|fatal|TRACE|DEBUG|INFO|WARN|ERROR|FATAL]

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

  --json                                                                            format output as json

  --loglevel=(trace|debug|info|warn|error|fatal|TRACE|DEBUG|INFO|WARN|ERROR|FATAL)  [default: warn] logging level for
                                                                                    this command invocation

  --tag=tag                                                                         Tag the build with a label, useful
                                                                                    to identify in metrics

  --waittime=waittime                                                               [default: 120] Wait time for command
                                                                                    to finish in minutes
```

_See code: [lib/commands/sfpowerscripts/orchestrator/build.js](https://github.com/Accenture/sfpowerscripts/blob/v1.4.5/lib/commands/sfpowerscripts/orchestrator/build.js)_

## `sfdx sfpowerscripts:orchestrator:deploy`

Deploy packages from the provided aritfact directory, to a given org, using the order and configurable flags provided in sfdx-project.json

```
Deploy packages from the provided aritfact directory, to a given org, using the order and configurable flags provided in sfdx-project.json

USAGE
  $ sfdx sfpowerscripts:orchestrator:deploy -u <string> [--artifactdir <directory>] [--waittime <number>] [-g <array>] 
  [-t <string>] [--skipifalreadyinstalled] [--json] [--loglevel 
  trace|debug|info|warn|error|fatal|TRACE|DEBUG|INFO|WARN|ERROR|FATAL]

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

  --json                                                                            format output as json

  --loglevel=(trace|debug|info|warn|error|fatal|TRACE|DEBUG|INFO|WARN|ERROR|FATAL)  [default: warn] logging level for
                                                                                    this command invocation

  --skipifalreadyinstalled                                                          Skip the package installation if the
                                                                                    package is already installed in the
                                                                                    org

  --waittime=waittime                                                               [default: 120] Wait time for command
                                                                                    to finish in minutes

EXAMPLE
  $ sfdx sfpowerscripts:orchestrator:deploy -u <username>
```

_See code: [lib/commands/sfpowerscripts/orchestrator/deploy.js](https://github.com/Accenture/sfpowerscripts/blob/v1.4.5/lib/commands/sfpowerscripts/orchestrator/deploy.js)_


## `sfdx sfpowerscripts:orchestrator:promote`

Promotes validated unlocked packages with code coverage greater than 75%

```
Promotes validated unlocked packages with code coverage greater than 75%

USAGE
  $ sfdx sfpowerscripts:orchestrator:promote -d <directory> [-v <string>] [--json] [--loglevel 
  trace|debug|info|warn|error|fatal|TRACE|DEBUG|INFO|WARN|ERROR|FATAL]

OPTIONS
  -d, --artifactdir=artifactdir                                                     (required) [default: artifacts] The
                                                                                    directory where artifacts are
                                                                                    located

  -v, --devhubalias=devhubalias                                                     [default: HubOrg] Provide the alias
                                                                                    of the devhub previously
                                                                                    authenticated, default value is
                                                                                    HubOrg if using the Authenticate
                                                                                    Devhub task

  --json                                                                            format output as json

  --loglevel=(trace|debug|info|warn|error|fatal|TRACE|DEBUG|INFO|WARN|ERROR|FATAL)  [default: warn] logging level for
                                                                                    this command invocation

EXAMPLE
  $ sfdx sfpowerscripts:orchestrator:promote -d path/to/artifacts -v <org>
```

_See code: [lib/commands/sfpowerscripts/orchestrator/promote.js](https://github.com/Accenture/sfpowerscripts/blob/v1.4.5/lib/commands/sfpowerscripts/orchestrator/promote.js)_

## `sfdx sfpowerscripts:orchestrator:publish`

Publish packages to an artifact registry, using a user-provided script that is responsible for authenticating & uploading to the registry.

```
Publish packages to an artifact registry, using a user-provided script that is responsible for authenticating & uploading to the registry.

USAGE
  $ sfdx sfpowerscripts:orchestrator:publish -d <directory> -f <filepath> [-p -v <string>] [-t <string>] [--json] 
  [--loglevel trace|debug|info|warn|error|fatal|TRACE|DEBUG|INFO|WARN|ERROR|FATAL]

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

  --json                                                                            format output as json

  --loglevel=(trace|debug|info|warn|error|fatal|TRACE|DEBUG|INFO|WARN|ERROR|FATAL)  [default: warn] logging level for
                                                                                    this command invocation

EXAMPLES
  $ sfdx sfpowerscripts:orchestrator:publish -f path/to/script
  $ sfdx sfpowerscripts:orchestrator:publish -p -v HubOrg
```

_See code: [lib/commands/sfpowerscripts/orchestrator/publish.js](https://github.com/Accenture/sfpowerscripts/blob/v1.4.5/lib/commands/sfpowerscripts/orchestrator/publish.js)_

## `sfdx sfpowerscripts:changelog:generate`

Generates release changelog, providing a summary of artifact versions, work items and commits introduced in a release. Creates a release definition based on artifacts contained in the artifact directory, and compares it to previous release definition in changelog stored on a source repository

```
[BETA] Generates release changelog, providing a summary of artifact versions, work items and commits introduced in a release. Creates a release definition based on artifacts contained in the artifact directory, and compares it to previous release definition in changelog stored on a source repository

USAGE
  $ sfdx sfpowerscripts:changelog:generate -d <directory> -n <string> -w <string> -r <string> -b <string> [--limit 
  <integer>] [--workitemurl <string>] [--showallartifacts] [--json] [--loglevel 
  trace|debug|info|warn|error|fatal|TRACE|DEBUG|INFO|WARN|ERROR|FATAL]

OPTIONS
  -b, --branchname=branchname                                                       (required) Repository branch in
                                                                                    which the changelog files are
                                                                                    located

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

_See code: [lib/commands/sfpowerscripts/changelog/generate.js](https://github.com/Accenture/sfpowerscripts/blob/v1.4.5/lib/commands/sfpowerscripts/changelog/generate.js)_


## `sfdx sfpowerscripts:package:data:create`

Creates a versioned artifact from a source directory containing SFDMU-based data (in csv format and export json). The artifact can be consumed by release pipelines, to deploy the data to orgs

```
Creates a versioned artifact from a source directory containing SFDMU-based data (in csv format and export json). The artifact can be consumed by release pipelines, to deploy the data to orgs

USAGE
  $ sfdx sfpowerscripts:package:data:create -n <string> -v <string> [--artifactdir <directory>] [--diffcheck] [--branch 
  <string>] [--gittag] [-r <string>] [--refname <string>] [--json] [--loglevel 
  trace|debug|info|warn|error|fatal|TRACE|DEBUG|INFO|WARN|ERROR|FATAL]

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

  --json
      format output as json

  --loglevel=(trace|debug|info|warn|error|fatal|TRACE|DEBUG|INFO|WARN|ERROR|FATAL)
      [default: warn] logging level for this command invocation

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

_See code: [lib/commands/sfpowerscripts/package/data/create.js](https://github.com/Accenture/sfpowerscripts/blob/v1.4.5/lib/commands/sfpowerscripts/package/data/create.js)_

## `sfdx sfpowerscripts:analyze:pmd`

This task is used to run a static analysis of the apex classes and triggers using PMD, Please ensure that the SFDX CLI and sfpowerkit plugin are installed before using this task

```
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

_See code: [lib/commands/sfpowerscripts/analyze/pmd.js](https://github.com/Accenture/sfpowerscripts/blob/v1.4.5/lib/commands/sfpowerscripts/analyze/pmd.js)_

## `sfdx sfpowerscripts:apextests:trigger`

Triggers Apex unit test in an org. Supports test level RunAllTestsInPackage, which optionally allows validation of individual class code coverage

```
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

_See code: [lib/commands/sfpowerscripts/apextests/trigger.js](https://github.com/Accenture/sfpowerscripts/blob/v1.4.5/lib/commands/sfpowerscripts/apextests/trigger.js)_

## `sfdx sfpowerscripts:apextests:validate`

Validates apex test coverage in the org, Please ensure that the SFDX CLI and sfpowerkit plugin are installed before using this task.

```
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

_See code: [lib/commands/sfpowerscripts/apextests/validate.js](https://github.com/Accenture/sfpowerscripts/blob/v1.4.5/lib/commands/sfpowerscripts/apextests/validate.js)_

## `sfdx sfpowerscripts:package:data:install`

Installs a SFDMU-based data package consisting of csvfiles and export.json to a target org

```
Installs a SFDMU-based data package consisting of csvfiles and export.json to a target org

USAGE
  $ sfdx sfpowerscripts:package:data:install -n <string> -u <string> [--artifactdir <directory>] [-s] 
  [--skipifalreadyinstalled] [--subdirectory <directory>] [--json] [--loglevel 
  trace|debug|info|warn|error|fatal|TRACE|DEBUG|INFO|WARN|ERROR|FATAL]

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

  --json                                                                            format output as json

  --loglevel=(trace|debug|info|warn|error|fatal|TRACE|DEBUG|INFO|WARN|ERROR|FATAL)  [default: warn] logging level for
                                                                                    this command invocation

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

_See code: [lib/commands/sfpowerscripts/package/data/install.js](https://github.com/Accenture/sfpowerscripts/blob/v1.4.5/lib/commands/sfpowerscripts/package/data/install.js)_

## `sfdx sfpowerscripts:package:delta:create`

This task is used to create a delta package between two commits and bundle the created delta as as a deployable artifact. Please ensure that the SFDX CLI and sfpowerkit plugin are installed before using this task

```
This task is used to create a delta package between two commits and bundle the created delta as as a deployable artifact. Please ensure that the SFDX CLI and sfpowerkit plugin are installed before using this task

USAGE
  $ sfdx sfpowerscripts:package:delta:create -r <string> -v <string> [-n <string>] [-t <string>] [--repourl <string>] 
  [--branch <string>] [--artifactdir <directory>] [-x] [--refname <string>] [--json] [--loglevel 
  trace|debug|info|warn|error|fatal|TRACE|DEBUG|INFO|WARN|ERROR|FATAL]

OPTIONS
  -n, --package=package                                                             The name of the package

  -r, --revisionfrom=revisionfrom                                                   (required) Provide the full SHA
                                                                                    Commit ID, from where the diff
                                                                                    should start generating

  -t, --revisionto=revisionto                                                       [default: HEAD] If not set, the head
                                                                                    commit ID of the current branch is
                                                                                    used

  -v, --versionname=versionname                                                     (required) Provide a meaningful name
                                                                                    such as the default value, so this
                                                                                    artifact can be identified in the
                                                                                    release

  -x, --generatedestructivemanifest                                                 Check this option to generate a
                                                                                    destructive manifest to be deployed

  --artifactdir=artifactdir                                                         [default: artifacts] The directory
                                                                                    where the artifact is to be written

  --branch=branch                                                                   The git branch that this build is
                                                                                    triggered on, Useful for metrics and
                                                                                    general identification purposes

  --json                                                                            format output as json

  --loglevel=(trace|debug|info|warn|error|fatal|TRACE|DEBUG|INFO|WARN|ERROR|FATAL)  [default: warn] logging level for
                                                                                    this command invocation

  --refname=refname                                                                 Reference name to be prefixed to
                                                                                    output variables

  --repourl=repourl                                                                 Custom source repository URL to use
                                                                                    in artifact metadata, overrides
                                                                                    origin URL defined in git config

EXAMPLES
  $ sfdx sfpowerscripts:package:delta:create -n <packagename> -r <61635fb> -t <3cf01b9> -v <version>

  Output variable:
  sfpowerscripts_delta_package_path
  <refname>_sfpowerscripts_delta_package_path
  sfpowerscripts_artifact_metadata_directory
  <refname>_sfpowerscripts_artifact_metadata_directory
  sfpowerscripts_artifact_directory
  <refname>_sfpowerscripts_artifact_directory
```

_See code: [lib/commands/sfpowerscripts/package/delta/create.js](https://github.com/Accenture/sfpowerscripts/blob/v1.4.5/lib/commands/sfpowerscripts/package/delta/create.js)_

## `sfdx sfpowerscripts:package:incrementBuildNumber`

Increment the selected version counter by one and optionally commit changes to sfdx-project.json. This command does not push changes to the source repository

```
Increment the selected version counter by one and optionally commit changes to sfdx-project.json. This command does not push changes to the source repository

USAGE
  $ sfdx sfpowerscripts:package:incrementBuildNumber [--segment <string>] [-a -r <string>] [-n <string>] [-d <string>] 
  [-c] [--refname <string>] [--json] [--loglevel trace|debug|info|warn|error|fatal|TRACE|DEBUG|INFO|WARN|ERROR|FATAL]

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

  --json
      format output as json

  --loglevel=(trace|debug|info|warn|error|fatal|TRACE|DEBUG|INFO|WARN|ERROR|FATAL)
      [default: warn] logging level for this command invocation

  --refname=refname
      Reference name to be prefixed to output variables

  --segment=Major|Minor|Patch|BuildNumber
      [default: BuildNumber] Select the segment of the version

EXAMPLES
  $ sfdx sfpowerscripts:package:incrementBuildNumber --segment BuildNumber -n packagename -c

  Output variable:
  sfpowerscripts_incremented_project_version
  <refname>_sfpowerscripts_incremented_project_version
```

_See code: [lib/commands/sfpowerscripts/package/incrementBuildNumber.js](https://github.com/Accenture/sfpowerscripts/blob/v1.4.5/lib/commands/sfpowerscripts/package/incrementBuildNumber.js)_

## `sfdx sfpowerscripts:package:source:create`

This task simulates a packaging experience similar to unlocked packaging - creating an artifact that consists of the metadata (e.g. commit Id), source code & an optional destructive manifest. The artifact can then be consumed by release pipelines, to deploy the package

```
This task simulates a packaging experience similar to unlocked packaging - creating an artifact that consists of the metadata (e.g. commit Id), source code & an optional destructive manifest. The artifact can then be consumed by release pipelines, to deploy the package

USAGE
  $ sfdx sfpowerscripts:package:source:create -n <string> -v <string> [--artifactdir <directory>] [--diffcheck] 
  [--branch <string>] [--gittag] [-r <string>] [--refname <string>] [--json] [--loglevel 
  trace|debug|info|warn|error|fatal|TRACE|DEBUG|INFO|WARN|ERROR|FATAL]

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

  --json
      format output as json

  --loglevel=(trace|debug|info|warn|error|fatal|TRACE|DEBUG|INFO|WARN|ERROR|FATAL)
      [default: warn] logging level for this command invocation

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

_See code: [lib/commands/sfpowerscripts/package/source/create.js](https://github.com/Accenture/sfpowerscripts/blob/v1.4.5/lib/commands/sfpowerscripts/package/source/create.js)_

## `sfdx sfpowerscripts:package:source:install`

Installs a sfpowerscripts source package to the target org

```
Installs a sfpowerscripts source package to the target org

USAGE
  $ sfdx sfpowerscripts:package:source:install -n <string> -u <string> [--artifactdir <directory>] 
  [--skipifalreadyinstalled] [-s] [--subdirectory <directory>] [-o] [-t] [--waittime <string>] [--refname <string>] 
  [--json] [--loglevel trace|debug|info|warn|error|fatal|TRACE|DEBUG|INFO|WARN|ERROR|FATAL]

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

  --json                                                                            format output as json

  --loglevel=(trace|debug|info|warn|error|fatal|TRACE|DEBUG|INFO|WARN|ERROR|FATAL)  [default: warn] logging level for
                                                                                    this command invocation

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

_See code: [lib/commands/sfpowerscripts/package/source/install.js](https://github.com/Accenture/sfpowerscripts/blob/v1.4.5/lib/commands/sfpowerscripts/package/source/install.js)_

## `sfdx sfpowerscripts:package:unlocked:create`

Creates a new package version, and generates an artifact that consists of the metadata (e.g. version Id). The artifact can then be consumed by release pipelines, to install the unlocked package. Utilize this task in a package build for DX Unlocked Package

```
Creates a new package version, and generates an artifact that consists of the metadata (e.g. version Id). The artifact can then be consumed by release pipelines, to install the unlocked package. Utilize this task in a package build for DX Unlocked Package

USAGE
  $ sfdx sfpowerscripts:package:unlocked:create -n <string> [-b] [-k <string> | -x] [--diffcheck] [--gittag] [-r 
  <string>] [--versionnumber <string>] [-f <filepath>] [--artifactdir <directory>] [--enablecoverage] [-s] [--branch 
  <string>] [--tag <string>] [--waittime <string>] [--refname <string>] [-v <string>] [--apiversion <string>] [--json] 
  [--loglevel trace|debug|info|warn|error|fatal|TRACE|DEBUG|INFO|WARN|ERROR|FATAL]

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

  --json
      format output as json

  --loglevel=(trace|debug|info|warn|error|fatal|TRACE|DEBUG|INFO|WARN|ERROR|FATAL)
      [default: warn] logging level for this command invocation

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

_See code: [lib/commands/sfpowerscripts/package/unlocked/create.js](https://github.com/Accenture/sfpowerscripts/blob/v1.4.5/lib/commands/sfpowerscripts/package/unlocked/create.js)_

## `sfdx sfpowerscripts:package:unlocked:install`

Installs an unlocked package using sfpowerscripts metadata

```
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

  --json                                                                            format output as json

  --loglevel=(trace|debug|info|warn|error|fatal|TRACE|DEBUG|INFO|WARN|ERROR|FATAL)  [default: warn] logging level for
                                                                                    this command invocation

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

_See code: [lib/commands/sfpowerscripts/package/unlocked/install.js](https://github.com/Accenture/sfpowerscripts/blob/v1.4.5/lib/commands/sfpowerscripts/package/unlocked/install.js)_

## `sfdx sfpowerscripts:pool:delete`

Deletes the pooled scratch orgs from the Scratch Org Pool

```
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

  --json                                                                            format output as json

  --loglevel=(trace|debug|info|warn|error|fatal|TRACE|DEBUG|INFO|WARN|ERROR|FATAL)  [default: warn] logging level for
                                                                                    this command invocation

EXAMPLES
  $ sfdx sfpowerscripts:pool:delete -t core 
  $ sfdx sfpowerscripts:pool:delete -t core -v devhub
```

_See code: [lib/commands/sfpowerscripts/pool/delete.js](https://github.com/Accenture/sfpowerscripts/blob/v1.4.5/lib/commands/sfpowerscripts/pool/delete.js)_

## `sfdx sfpowerscripts:pool:fetch`

Gets an active/unused scratch org from the scratch org pool

```
Gets an active/unused scratch org from the scratch org pool

USAGE
  $ sfdx sfpowerscripts:pool:fetch -t <string> [-v <string>] [--apiversion <string>] [--json] [--loglevel 
  trace|debug|info|warn|error|fatal|TRACE|DEBUG|INFO|WARN|ERROR|FATAL]

OPTIONS
  -t, --tag=tag                                                                     (required) (required) tag used to
                                                                                    identify the scratch org pool

  -v, --targetdevhubusername=targetdevhubusername                                   username or alias for the dev hub
                                                                                    org; overrides default dev hub org

  --apiversion=apiversion                                                           override the api version used for
                                                                                    api requests made by this command

  --json                                                                            format output as json

  --loglevel=(trace|debug|info|warn|error|fatal|TRACE|DEBUG|INFO|WARN|ERROR|FATAL)  [default: info] logging level for
                                                                                    this command invocation

EXAMPLES
  $ sfdx sfpowerkit:pool:fetch -t core 
  $ sfdx sfpowerkit:pool:fetch -t core -v devhub
  $ sfdx sfpowerkit:pool:fetch -t core -v devhub -m
  $ sfdx sfpowerkit:pool:fetch -t core -v devhub -s testuser@test.com
```

_See code: [lib/commands/sfpowerscripts/pool/fetch.js](https://github.com/Accenture/sfpowerscripts/blob/v1.4.5/lib/commands/sfpowerscripts/pool/fetch.js)_

## `sfdx sfpowerscripts:pool:list`

Retrieves a list of active scratch org and details from any pool. If this command is run with -m|--mypool, the command will retrieve the passwords for the pool created by the user who is executing the command.

```
Retrieves a list of active scratch org and details from any pool. If this command is run with -m|--mypool, the command will retrieve the passwords for the pool created by the user who is executing the command.

USAGE
  $ sfdx sfpowerscripts:pool:list [-t <string>] [-m] [-a] [-v <string>] [--apiversion <string>] [--json] [--loglevel 
  trace|debug|info|warn|error|fatal|TRACE|DEBUG|INFO|WARN|ERROR|FATAL]

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

  --json                                                                            format output as json

  --loglevel=(trace|debug|info|warn|error|fatal|TRACE|DEBUG|INFO|WARN|ERROR|FATAL)  [default: warn] logging level for
                                                                                    this command invocation

EXAMPLES
  $ sfdx sfpowerscripts:pool:list -t core 
  $ sfdx sfpowerscripts:pool:list -t core -v devhub
  $ sfdx sfpowerscripts:pool:list -t core -v devhub -m
  $ sfdx sfpowerscripts:pool:list -t core -v devhub -m -a
```

_See code: [lib/commands/sfpowerscripts/pool/list.js](https://github.com/Accenture/sfpowerscripts/blob/v1.4.5/lib/commands/sfpowerscripts/pool/list.js)_

## `sfdx sfpowerscripts:source:deploy`

Deploy source to org using mdapi based deploy (converts source to mdapi and use mdapi deployment)

```
Deploy source to org using mdapi based deploy (converts source to mdapi and use mdapi deployment)

USAGE
  $ sfdx sfpowerscripts:source:deploy [-u <string>] [--sourcedir <string>] [--waittime <string>] [-c] [-f <string>] [-l 
  <string>] [--specifiedtests <string>] [--apextestsuite <string>] [--ignorewarnings] [--ignoreerrors] [-b] [--refname 
  <string>] [--json] [--loglevel trace|debug|info|warn|error|fatal|TRACE|DEBUG|INFO|WARN|ERROR|FATAL]

OPTIONS
  -b, --istobreakbuildifempty
      Uncheck this field, to allow for empty folders not to break build, useful in the case of pre/post step uniformity 
      across projects

  -c, --checkonly
      Validate a deployment, but don't save to the org, Use this for Stage 1/2 CI Run's

  -f, --validationignore=validationignore
      [default: .forceignore] Validation only deployment has issues with certain metadata such as apexttestsuite, create a 
      different file similar to .forceignore and use it during validate only deployment

  -l, --testlevel=NoTestRun|RunSpecifiedTests|RunApexTestSuite|RunLocalTests|RunAllTestsInOrg
      [default: NoTestRun] The test level of the test that need to be executed when the code is to be deployed

  -u, --targetorg=targetorg
      [default: scratchorg] Alias or username of the target org where the code should be deployed

  --apextestsuite=apextestsuite
      Name of the Apex Test Suite that needs to be executed during this deployment

  --ignoreerrors
      Ignores the deploy errors, and continues with the deploy operation

  --ignorewarnings
      Ignores any warnings generated during metadata deployment

  --json
      format output as json

  --loglevel=(trace|debug|info|warn|error|fatal|TRACE|DEBUG|INFO|WARN|ERROR|FATAL)
      [default: warn] logging level for this command invocation

  --refname=refname
      Reference name to be prefixed to output variables

  --sourcedir=sourcedir
      [default: force-app] The source directory to be deployed

  --specifiedtests=specifiedtests
      Specify a comma seperated values of Apex Test that need to be executed during this deployment

  --waittime=waittime
      [default: 20] wait time for command to finish in minutes

EXAMPLES
  $ sfdx sfpowerscripts:source:deploy -u scratchorg --sourcedir force-app -c

  Output variable:
  sfpowerkit_deploysource_id
  <refname_sfpowerkit_deploysource_id
```

_See code: [lib/commands/sfpowerscripts/source/deploy.js](https://github.com/Accenture/sfpowerscripts/blob/v1.4.5/lib/commands/sfpowerscripts/source/deploy.js)_

## `sfdx sfpowerscripts:source:deployDestructiveManifest`

Delete components in org according to destructive manifest - an empty package.xml will be automatically created, Read more about the task at  https://sfpowerscripts.com/tasks/deployment-tasks/deploy-destructive-maifest-to-an-org/

```
Delete components in org according to destructive manifest - an empty package.xml will be automatically created, Read more about the task at  https://sfpowerscripts.com/tasks/deployment-tasks/deploy-destructive-maifest-to-an-org/

USAGE
  $ sfdx sfpowerscripts:source:deployDestructiveManifest [-u <string>] [-m <string>] [-f <string> | -t <string>] 
  [--skiponmissingmanifest] [--json] [--loglevel trace|debug|info|warn|error|fatal|TRACE|DEBUG|INFO|WARN|ERROR|FATAL]

OPTIONS
  -f, --destructivemanifestfilepath=destructivemanifestfilepath
      The location to the xml file which contains the destructive changes

  -m, --method=Text|FilePath
      [default: Text] If text is specified, add the members in the next field, if URL, pass in the location of the 
      destructiveChanges.xml such as the raw git url

  -t, --destructivemanifesttext=destructivemanifesttext
      Type in the destructive manifest, follow the instructions, 
      https://developer.salesforce.com/docs/atlas.en-us.daas.meta/daas/daas_destructive_changes.htm

  -u, --targetorg=targetorg
      [default: scratchorg] Alias or username of the target org where the code should be deployed

  --json
      format output as json

  --loglevel=(trace|debug|info|warn|error|fatal|TRACE|DEBUG|INFO|WARN|ERROR|FATAL)
      [default: warn] logging level for this command invocation

  --skiponmissingmanifest
      Skip if unable to find destructive manfiest file

EXAMPLES
  $ sfdx sfpowerscripts:source:deployDestructiveManifest -u scratchorg -m Text -t "<?xml version="1.0" 
  encoding="UTF-8"?>
  <Package 
  xmlns="http://soap.sforce.com/2006/04/metadata"><types><members>myobject__c</members><name>CustomObject</name></types>
  </Package>"
```

_See code: [lib/commands/sfpowerscripts/source/deployDestructiveManifest.js](https://github.com/Accenture/sfpowerscripts/blob/v1.4.5/lib/commands/sfpowerscripts/source/deployDestructiveManifest.js)_
<!-- commandsstop -->
