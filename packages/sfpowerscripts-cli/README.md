# sfpowerscripts

A Salesforce build system for package based development as a sfdx plugin that can be implemented in any CI/CD system of choice. Read more about the plugin and details here - https://dxatscale.gitbook.io/sfpowerscripts/

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


## Using sfpowerscripts

### Modifiers used by Orchestrator

[sfpowerscripts:orchestrator](https://app.gitbook.com/@dxatscale/s/sfpowerscripts/faq/orchestrator) commands allow controlling attributes of a package in its stage by adding additional properties to each package as described in sfdx-project.json. This allows one to change the behaviour of the pipeline without changing any pipeline scripts

```
  {
    "path": "path--to--package",
    "package": "name--of-the-package", //mandatory, when used with sfpowerscripts
    "versionNumber": "X.Y.Z.[NEXT/BUILDNUMBER]",
    "type":"data" //Mention the type of package, only to be used for source and data packages
    "aliasfy": <boolean>, // Only for source packages, allows to deploy a subfolder whose name matches the alias of the org when using deploy command
    "skipDeployOnOrgs": ["org1","org2"], // Comma seperated values of org's to mention this package should not be deployed in this org
    "isOptimizedDeployment": <boolean>  // default:true for source packages, Utilizes the apex classes in the package for deployment,
    "skipTesting":<boolean> //default:false, skip apex testing installation of source package
    "skipCoverageValidation":<boolean> //default:false, skip apex coverage validation during validation phase,
    "destructiveChangePath:<path> // only for source, if enabled, this will be applied before the package is deployed
    "assignPermSetsPreDeployment: ["","",]
    "assignPermSetsPostDeployment: ["","",]
    "preDeploymentScript":<path> //All Packages
    "postDeploymentScript:<path> // All packages
    "reconcileProfiles:<boolean> //default:true Source Packages
    "ignoreOnStage": [ //Skip this package during the below orchestrator commands
         "prepare",
          "validate"
        ]
    "alwaysDeploy": <boolean> // If true, deploys package even if already installed in org,
    "buildCollection": ["packageB", "packageC"] // packages in the same build collection are always built together, as long as one package in the collection has changed
  }
```
### Enabling StatsD Metrics
Almost all the CLI commands have StatsD metrics capture enabled. This means you can setup deployment dashboards in a tool like
Graphite or DataDog and capture your deployment statistics. Read more about this feature [here](https://app.gitbook.com/@dxatscale/s/sfpowerscripts/faq/metrics-and-dashboards)

To enable stasd, add the following environment variable, in the format below

```
 # Set STATSD Environment Variables for logging metrics about this build
 export SFPOWERSCRIPTS_STATSD=true
 export SFPOWERSCRIPTS_STATSD_HOST=172.23.95.52
 export SFPOWERSCRIPTS_STATSD_PORT=8125     // Optional, defaults to 8125
 export SFPOWERSCRIPTS_STATSD_PROTOCOL=UDP  // Optional, defualts to UDP, Supports UDP/TCP

```

### Output Variables

Many of the commands listed below will output variables which may be consumed as flag inputs in subsequent commands. Simply pass the **variable name** to the command, and it will be substituted with the corresponding value, at runtime.

Eg.
```
  $ sfdx sfpowerscripts:package:version:increment -n <mypackage>

    ...

    Output variable:
    sfpowerscripts_incremented_project_version=1.0.0.1

  $ sfdx sfpowerscripts:package:source:create -n <mypackage> --versionnumber sfpowerscripts_incremented_project_version
```

The following output variables are currently supported:

* sfpowerscripts_incremented_project_version
* sfpowerscripts_artifact_directory
* sfpowerscripts_artifact_metadata_directory
* sfpowerscripts_package_version_id
* sfpowerscripts_package_version_number
* sfpowerscripts_pmd_output_path
* sfpowerscripts_scratchorg_username
* sfpowerscripts_installsourcepackage_deployment_id

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
   - [`sfdx sfpowerscripts:orchestrator:validate`](#sfdx-sfpowerscriptsorchestratorvalidate)
   - [`sfdx sfpowerscripts:orchestrator:validateAgainstOrg`](#sfdx-sfpowerscriptsorchestratorvalidateagainstorg)
   - [`sfdx sfpowerscripts:orchestrator:quickbuild`](#sfdx-sfpowerscriptsorchestratorquickbuild)
   - [`sfdx sfpowerscripts:orchestrator:build`](#sfdx-sfpowerscriptsorchestratorbuild)
   - [`sfdx sfpowerscripts:orchestrator:deploy`](#sfdx-sfpowerscriptsorchestratordeploy)
   - [`sfdx sfpowerscripts:orchestrator:release`](#sfdx-sfpowerscriptsorchestratorrelease)
   - [`sfdx sfpowerscripts:orchestrator:promote`](#sfdx-sfpowerscriptsorchestratorpromote)
   - [`sfdx sfpowerscripts:orchestrator:publish`](#sfdx-sfpowerscriptsorchestratorpublish)

- Changelog (Track Releases)
   - [`sfdx sfpowerscripts:changelog:generate`](#sfdx-sfpowerscriptschangeloggenerate)

 - Package Commands ( Build your own workflow)
	 - [`sfdx sfpowerscripts:package:data:create`](#sfdx-sfpowerscriptspackagedatacreate)
	 - [`sfdx sfpowerscripts:package:data:install`](#sfdx-sfpowerscriptspackagedatainstall)
	 - [`sfdx sfpowerscripts:package:source:create`](#sfdx-sfpowerscriptspackagesourcecreate)
	 - [`sfdx sfpowerscripts:package:source:install`](#sfdx-sfpowerscriptspackagesourceinstall)
	 - [`sfdx sfpowerscripts:package:unlocked:create`](#sfdx-sfpowerscriptspackageunlockedcreate)
	 - [`sfdx sfpowerscripts:package:unlocked:install`](#sfdx-sfpowerscriptspackageunlockedinstall)
   - [`sfdx sfpowerscripts:package:version:increment`](#sfdx-sfpowerscriptspackageversionincrement)

 - Pool Management
	 - [`sfdx sfpowerscripts:pool:delete `](#sfdx-sfpowerscriptspooldelete)
	 - [`sfdx sfpowerscripts:pool:fetch`](#sfdx-sfpowerscriptspoolfetch)
	 - [`sfdx sfpowerscripts:pool:list`](#sfdx-sfpowerscriptspoollist)

 - Static Analysis
	 - [`sfdx sfpowerscripts:analyze:pmd`](#sfdx-sfpowerscriptsanalyzepmd)

- Apex tests
  - [`sfdx sfpowerscripts:apextests:trigger`](#sfdx-sfpowerscriptsapexteststrigger)
  - [`sfdx sfpowerscripts:apextests:validate`](#sfdx-sfpowerscriptsapextestsvalidate)

- Artifacts
  - [`sfdx sfpowerscripts:artifacts:fetch`](#sfdx-sfpowerscriptsartifactsfetch)

## `sfdx sfpowerscripts:orchestrator:prepare`

Prepare a pool of scratchorgs with all the packages upfront, so that any incoming change can be validated in an optimized manner,
Please note for this feature to work the devhub should be enabled and scratchorgpool (additional fields to ScratchOrgInfo object)
should be deployed to devhub. Please see the instructions [here](https://github.com/Accenture/sfpowerkit/wiki/Getting-started-with-ScratchOrg-Pooling#1-install-the-supporting-fields-and-validation-rule-to-devhub). This command also
install an unlocked package to the scratch org 'sfpowerscripts-artifact' (04t1P000000ka9mQAA) for skipping unchanged packages during
a validation phase. This particular package can be prebuilt against your org and the ID could be overriden by setting up the
environment variable SFPOWERSCRIPTS_ARTIFACT_UNLOCKED_PACKAGE

```
Prepare a pool of scratchorgs with all the packages upfront, so that any incoming change can be validated in an optimized manner,


USAGE
  $ sfdx sfpowerscripts:orchestrator:prepare -t <string> [-e <number>] [-m <number>] [-f <filepath>]
  [--installassourcepackages --installall] [-s <filepath>] [--succeedondeploymenterrors] [--keys <string>] [-v <string>]
  [--apiversion <string>]

OPTIONS
  -f, --poolconfig=poolconfig                                                       [default: config/poolconfig.json]
                                                                                    The path to the configuration file
                                                                                    for creating a pool of scratch orgs

  -v, --targetdevhubusername=targetdevhubusername                                   username or alias for the dev hub
                                                                                    org; overrides default dev hub org

  --apiversion=apiversion                                                           API version to be used

EXAMPLE
  $ sfdx sfpowerscripts:orchestrator:prepare -f config/mypoolconfig.json  -v <devhub>
```

_See code: [commands/sfpowerscripts/orchestrator/prepare.ts](https://github.com/Accenture/sfpowerscripts/tree/develop/packages/sfpowerscripts-cli/src/commands/sfpowerscripts/orchestrator/prepare.ts)_

## `sfdx sfpowerscripts:orchestrator:validate`

Validate the incoming change against a prepared scratch org fetched from the provided pools (created using the prepare command). If the Sfpowerscripts Artifact package is installed in the scratch orgs, only the changed packages in the repo will be deployed by comparing against the package version installed in the fetched scratchorg.

```
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

  --keys=keys                                                                       Keys to be used while installing any
                                                                                    managed package dependencies. Required
                                                                                    format is a string of key-value pairs
                                                                                    separated by spaces e.g. packageA:pw123
                                                                                    packageB:pw123 packageC:pw123

  --shapefile=shapefile                                                             Path to .zip file of scratch org
                                                                                    shape / metadata to deploy

EXAMPLE
  $ sfdx sfpowerscripts:orchestrator:validate -p "POOL_TAG_1,POOL_TAG_2" -u <devHubUsername> -i <clientId> -f <jwt_file>
```

_See code: [commands/sfpowerscripts/orchestrator/validate.ts](https://github.com/Accenture/sfpowerscripts/tree/develop/packages/sfpowerscripts-cli/src/commands/sfpowerscripts/orchestrator/validate.ts)_

## `sfdx sfpowerscripts:orchestrator:validateAgainstOrg`

Validate the incoming change against a target org. If the Sfpowerscripts Artifact package is installed in the target org, only changed packages in the repo will be deployed by comparing against the package version installed in the target org.

```
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

_See code: [commands/sfpowerscripts/orchestrator/validateAgainstOrg.ts](https://github.com/Accenture/sfpowerscripts/tree/develop/packages/sfpowerscripts-cli/src/commands/sfpowerscripts/orchestrator/validateAgainstOrg.ts)_

## `sfdx sfpowerscripts:orchestrator:quickbuild`

Build packages (unlocked/source/data) in a repo in parallel, without validating depenencies or coverage in the case of unlocked packages.
For diffcheck to work(build packages that are changed), it compares against the last know git tags, so make sure that you strategically place
the tags push at the required state in your pipeline.

```
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

  --tag=tag                                                                         Tag the build with a label, useful
                                                                                    to identify in metrics

  --waittime=waittime                                                               [default: 120] Wait time for command
                                                                                    to finish in minutes
```

_See code: [commands/sfpowerscripts/orchestrator/quickbuild.ts](https://github.com/Accenture/sfpowerscripts/tree/develop/packages/sfpowerscripts-cli/src/commands/sfpowerscripts/orchestrator/quickbuild.ts)_


## `sfdx sfpowerscripts:orchestrator:build`

Build all packages (unlocked/source/data) in a repo in parallel, respecting the dependency of each packages and generate artifacts to a provided directory.For diffcheck to work(build packages that are changed), it compares against the last know git tags, so make sure that you strategically place the tags push at the required state in your pipeline.

```
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

  --tag=tag                                                                         Tag the build with a label, useful
                                                                                    to identify in metrics

  --waittime=waittime                                                               [default: 120] Wait time for command
                                                                                    to finish in minutes
```

_See code: [commands/sfpowerscripts/orchestrator/build.ts](https://github.com/Accenture/sfpowerscripts/tree/develop/packages/sfpowerscripts-cli/src/commands/sfpowerscripts/orchestrator/build.ts)_

## `sfdx sfpowerscripts:orchestrator:deploy`

Deploy packages from the provided aritfact directory, to a given org, using the order and configurable flags provided in sfdx-project.json
`skipifalreadyinstalled` only works provide the target org has sfpowerscripts-artifact' (04t1P000000ka9mQAA) installed. Please note you can
deploy your own instance of 'sfpowerscripts-artifact' by building it from the repo and overriding using the environment variable SFPOWERSCRIPTS_ARTIFACT_UNLOCKED_PACKAGE

```
Deploy packages from the provided aritfact directory, to a given org, using the order and configurable flags provided in sfdx-project.json

USAGE
  $ sfdx sfpowerscripts:orchestrator:deploy -u <string> [--artifactdir <directory>] [--waittime <number>] [-g <array>]
  [-t <string>] [-b <string> --skipifalreadyinstalled]

OPTIONS
  -b, --baselineorg=baselineorg                                                     The org against which the package skip
                                                                                    should be baselined

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

_See code: [commands/sfpowerscripts/orchestrator/deploy.ts](https://github.com/Accenture/sfpowerscripts/tree/develop/packages/sfpowerscripts-cli/src/commands/sfpowerscripts/orchestrator/deploy.ts)_

## `sfdx sfpowerscripts:orchestrator:release`

Initiate a release to an org, according to the configuration defined in a release-definition YAML file

```
USAGE
  $ sfdx sfpowerscripts:orchestrator:release -u <string> [-p <filepath>] [--scope <string> [--npm | -f <filepath>]] [--npmrcpath <filepath> undefined] [-g <array>] [-t <string>] [--waittime <number>] [--keys <string>] [--generatechangelog]
  [--json] [--loglevel trace|debug|info|warn|error|fatal|TRACE|DEBUG|INFO|WARN|ERROR|FATAL]

OPTIONS
  -f, --scriptpath=scriptpath                                                       (Optional: no-NPM) Path to script that authenticates and downloads artifacts from the registry
  -g, --logsgroupsymbol=logsgroupsymbol                                             Symbol used by CICD platform to group/collapse logs in the console. Provide an opening group, and an optional closing group symbol.
  -p, --releasedefinition=releasedefinition                                         Path to YAML file containing map of packages and package versions to download
  -t, --tag=tag                                                                     Tag the release with a label, useful for identification in metrics
  -u, --targetorg=targetorg                                                         (required) [default: scratchorg] Alias/User Name of the target environment
  --generatechangelog                                                               Create a release changelog
  --json                                                                            format output as json

  --keys=keys                                                                       Keys to be used while installing any managed package dependencies. Required format is a string of key-value pairs separated by spaces e.g. packageA:pw123
                                                                                    packageB:pw123 packageC:pw123

  --loglevel=(trace|debug|info|warn|error|fatal|TRACE|DEBUG|INFO|WARN|ERROR|FATAL)  [default: warn] logging level for this command invocation

  --npm                                                                             Download artifacts from a pre-authenticated private npm registry

  --npmrcpath=npmrcpath                                                             Path to .npmrc file used for authentication to registry. If left blank, defaults to home directory

  --scope=scope                                                                     (required for NPM) User or Organisation scope of the NPM package

  --waittime=waittime                                                               [default: 120] Wait time for package installation

EXAMPLE
  sfdx sfpowerscripts:orchestrator:release -p path/to/releasedefinition.yml -u myorg --npm --scope myscope --generatechangelog
```

_See code: [commands/sfpowerscripts/orchestrator/release.ts](https://github.com/Accenture/sfpowerscripts/tree/develop/packages/sfpowerscripts-cli/src/commands/sfpowerscripts/orchestrator/release.ts)_

## `sfdx sfpowerscripts:orchestrator:promote`

Promotes validated unlocked packages with code coverage greater than 75%

```
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

_See code: [commands/sfpowerscripts/orchestrator/promote.ts](https://github.com/Accenture/sfpowerscripts/tree/develop/packages/sfpowerscripts-cli/src/commands/sfpowerscripts/orchestrator/promote.ts)_

## `sfdx sfpowerscripts:orchestrator:publish`

Publish packages to an artifact registry, using a user-provided script that is responsible for authenticating & uploading to the registry.

```
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

  --gittag                                                                          Tag the current commit ID with an
                                                                                    annotated tag containing the package
                                                                                    name and version - does not push tag

  --pushgittag                                                                      Pushes the git tags created by this
                                                                                    command to the repo, ensure you have
                                                                                    access to the repo

  --npm                                                                             Upload artifacts to a pre-authenticated
                                                                                    npm registry

  --scope                                                                           User or Organisation scope of the NPM
                                                                                    package

  --npmtag                                                                          Add an optional distribution tag to NPM
                                                                                    packages. If not provided, the 'latest'
                                                                                    tag is set to the published version
EXAMPLES
  $ sfdx sfpowerscripts:orchestrator:publish -f path/to/script
  $ sfdx sfpowerscripts:orchestrator:publish --npm
  $ sfdx sfpowerscripts:orchestrator:publish -f path/to/script -p -v HubOrg
  $ sfdx sfpowerscripts:orchestrator:publish -f path/to/script --gittag --pushgittag
```

_See code: [commands/sfpowerscripts/orchestrator/publish.ts](https://github.com/Accenture/sfpowerscripts/tree/develop/packages/sfpowerscripts-cli/src/commands/sfpowerscripts/orchestrator/publish.ts)_

## `sfdx sfpowerscripts:changelog:generate`

Generates release changelog, providing a summary of artifact versions, work items and commits introduced in a release. Creates a release definition based on artifacts contained in the artifact directory, and compares it to previous release definition in changelog stored on a source repository

```
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

_See code: [commands/sfpowerscripts/changelog/generate.ts](https://github.com/Accenture/sfpowerscripts/tree/develop/packages/sfpowerscripts-cli/src/commands/sfpowerscripts/changelog/generate.ts)_



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

_See code: [commands/sfpowerscripts/analyze/pmd.ts](https://github.com/Accenture/sfpowerscripts/tree/develop/packages/sfpowerscripts-cli/src/commands/sfpowerscripts/analyze/pmd.ts)_

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

_See code: [commands/sfpowerscripts/apextests/trigger.ts](https://github.com/Accenture/sfpowerscripts/tree/develop/packages/sfpowerscripts-cli/src/commands/sfpowerscripts/apextests/trigger.ts)_

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

_See code: [commands/sfpowerscripts/apextests/validate.ts](https://github.com/Accenture/sfpowerscripts/tree/develop/packages/sfpowerscripts-cli/src/commands/sfpowerscripts/apextests/validate.ts)_


## `sfdx sfpowerscripts:package:data:create`

Creates a versioned artifact from a source directory containing SFDMU-based data (in csv format and export json). The artifact can be consumed by release pipelines, to deploy the data to orgs

```
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

_See code: [commands/sfpowerscripts/package/data/create.ts](https://github.com/Accenture/sfpowerscripts/tree/develop/packages/sfpowerscripts-cli/src/commands/sfpowerscripts/package/data/create.ts)_


## `sfdx sfpowerscripts:package:data:install`

Installs a SFDMU-based data package consisting of csvfiles and export.json to a target org

```
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

_See code: [commands/sfpowerscripts/package/data/install.ts](https://github.com/Accenture/sfpowerscripts/tree/develop/packages/sfpowerscripts-cli/src/commands/sfpowerscripts/package/data/install.ts)_


## `sfdx sfpowerscripts:package:source:create`

This task simulates a packaging experience similar to unlocked packaging - creating an artifact that consists of the metadata wrapped into an artifact. The artifact can then be consumed by release tasks, to deploy the package

```
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

_See code: [commands/sfpowerscripts/package/source/create.ts](https://github.com/Accenture/sfpowerscripts/tree/develop/packages/sfpowerscripts-cli/src/commands/sfpowerscripts/package/source/create.ts)_

## `sfdx sfpowerscripts:package:source:install`

Installs a sfpowerscripts source package to the target org. skipifalreadyinstalled` only works provide the target org has sfpowerscripts-artifact' (04t1P000000ka9mQAA) installed. Please note you can deploy your own instance of 'sfpowerscripts-artifact' by building it from the repo and overriding using the environment variable SFPOWERSCRIPTS_ARTIFACT_UNLOCKED_PACKAGE

```
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

_See code: [commands/sfpowerscripts/package/source/install.ts](https://github.com/Accenture/sfpowerscripts/tree/develop/packages/sfpowerscripts-cli/src/commands/sfpowerscripts/package/source/install.ts)_

## `sfdx sfpowerscripts:package:unlocked:create`

Creates a new package version, and generates an artifact that consists of the metadata (e.g. version Id). The artifact can then be consumed by release pipelines, to install the unlocked package. Utilize this task in a package build for DX Unlocked Package

```
Creates a new package version, and generates an artifact that consists of the metadata (e.g. version Id). The artifact can then be consumed by release pipelines, to install the unlocked package. Utilize this task in a package build for DX Unlocked Package

USAGE
  $ sfdx sfpowerscripts:package:unlocked:create -n <string> [-b] [-k <string> | -x] [--diffcheck] [--gittag] [-r
  <string>] [--versionnumber <string>] [-f <filepath>] [--artifactdir <directory>] [--enablecoverage] [-s] [--branch
  <string>] [--tag <string>] [--waittime <string>] [--refname <string>] [-v <string>] [--apiversion <string>]

OPTIONS

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

_See code: [commands/sfpowerscripts/package/unlocked/create.ts](https://github.com/Accenture/sfpowerscripts/tree/develop/packages/sfpowerscripts-cli/src/commands/sfpowerscripts/package/unlocked/create.ts)_

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

_See code: [commands/sfpowerscripts/package/unlocked/install.ts](https://github.com/Accenture/sfpowerscripts/tree/develop/packages/sfpowerscripts-cli/src/commands/sfpowerscripts/package/unlocked/install.ts)_


## `sfdx sfpowerscripts:package:version:increment`

Increment the selected version counter by one and optionally commit changes to sfdx-project.json. This command does not push changes to the source repository

```
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

_See code: [commands/sfpowerscripts/package/version/increment.ts](https://github.com/Accenture/sfpowerscripts/tree/develop/packages/sfpowerscripts-cli/src/commands/sfpowerscripts/package/version/increment.ts)_

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

EXAMPLES
  $ sfdx sfpowerscripts:pool:delete -t core
  $ sfdx sfpowerscripts:pool:delete -t core -v devhub
```

_See code: [commands/sfpowerscripts/pool/delete.ts](https://github.com/Accenture/sfpowerscripts/tree/develop/packages/sfpowerscripts-cli/src/commands/sfpowerscripts/pool/delete.ts)_

## `sfdx sfpowerscripts:pool:fetch`

Gets an active/unused scratch org from the scratch org pool

```
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

_See code: [commands/sfpowerscripts/pool/fetch.ts](https://github.com/Accenture/sfpowerscripts/tree/develop/packages/sfpowerscripts-cli/src/commands/sfpowerscripts/pool/fetch.ts)_

## `sfdx sfpowerscripts:pool:list`

Retrieves a list of active scratch org and details from any pool. If this command is run with -m|--mypool, the command will retrieve the passwords for the pool created by the user who is executing the command.

```
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

_See code: [commands/sfpowerscripts/pool/list.ts](https://github.com/Accenture/sfpowerscripts/tree/develop/packages/sfpowerscripts-cli/src/commands/sfpowerscripts/pool/list.ts)_

## `sfdx sfpowerscripts:artifacts:fetch`

```
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

_See code: [commands/sfpowerscripts/artifacts/fetch.ts](https://github.com/Accenture/sfpowerscripts/tree/develop/packages/sfpowerscripts-cli/src/commands/sfpowerscripts/artifacts/fetch.ts)_


<!-- commandsstop -->
