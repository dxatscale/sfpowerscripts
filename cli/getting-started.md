# Getting Started

### Installation

The [SFDX CLI](https://developer.salesforce.com/docs/atlas.en-us.sfdx_setup.meta/sfdx_setup/sfdx_setup_install_cli.htm) and [sfpowerkit plugin](https://github.com/Accenture/sfpowerkit) are required for this plugin to work. If you have not already done so, please install both of these before continuing.

To install the sfpowerscripts plugin, run the following command:

```text
$ sfdx plugins:install @dxatscale/sfpowerscripts
```

For automated installations as part of a CI process or Dockerfile:

```text
$ echo 'y' | sfdx plugins:install @dxatscale/sfpowerscripts
```

### Usage

```text
$ sfdx sfpowerscripts:COMMAND
running command...

$ sfdx --help sfpowerscripts:[COMMAND]
USAGE
  $ sfdx sfpowerscripts:COMMAND
OPTIONS
  -flag Description
EXAMPLE
  Output variable:

...
```

### Output variables

Many of the commands listed below will output variables which may be consumed as inputs to other tasks. The output variables are written to an environment file `.env` in a `key=value` format. A `readVars.sh` helper script is included as part of this package that can be used to read the values stored in the `.env` file and export them as environment variables.

One method of making the helper script globally invocable, is to install the NPM module as follows:

```text
  $ npm install -g @dxatscale/sfpowerscripts
```

The script is then invocable as `source readVars` from the command-line.

If you're using a Docker image as part of your build process, you could also `COPY` the script into the image and link it to `$PATH`.

The following code snippet is an example of how output variables may be used.

```text
$ sfdx sfpowerscripts:CreateDeltaPackage -n mypackage -r 61635fb -t 3cf01b9 -v 1.2.10 -b
$ source readVars
$ sfdx sfpowerscripts:DeploySource -u scratchorg --sourcedir ${sfpowerscripts_delta_package_path} -c
```

#### Reference name

Commands that output variables optionally accept a `--refname` flag that prefixes output variables with a user-specified string. The prefix is intended as a variable namespace that allows the same command to be invoked multiple times without overwriting the output variables.

```text
$ sfdx sfpowerscripts:CreateUnlockedPackage --refname core -n core_package -b -x -v DevHub
$ sfdx sfpowerscripts:CreateUnlockedPackage --refname utility -n utility_package -b -x -v Devhub

$ source readVars
$ echo $core_sfpowerscripts_package_version_id
  04t2v000007X2YRAA0
$ echo $utility_sfpowerscripts_package_version_id
  04t2v000007X2YWAA0
```

### Commands

* `sfpowerscripts:AnalyzeWithPMD`
* `sfpowerscripts:CreateDeltaPackage`
* `sfpowerscripts:CreateSourcePackage`
* `sfpowerscripts:CreateUnlockedPackage`
* `sfpowerscripts:DeployDestructiveManifest`
* `sfpowerscripts:DeploySource`
* `sfpowerscripts:ExportSource`
* `sfpowerscripts:IncrementBuildNumber`
* `sfpowerscripts:InstallUnlockedPackage`
* `sfpowerscripts:TriggerApexTest`
* `sfpowerscripts:ValidateApexCoverage`

### `sfpowerscripts:AnalyzeWithPMD`

This task is used to run a static analysis of the apex classes and triggers using PMD. Please ensure that the SFDX CLI and sfpowerkit plugin are installed before using this task.

```text
USAGE
  $ sfdx sfpowerscripts:AnalyzeWithPMD [--sourcedir <string>] [--ruleset <string>] [--rulesetpath <string>] [--format
  <string>] [-o <string>] [--version <string>] [-b] [-d <string>] [--refname <string>] [--json] [--loglevel
  trace|debug|info|warn|error|fatal|TRACE|DEBUG|INFO|WARN|ERROR|FATAL]

OPTIONS
  -b, --istobreakbuild                                                               Enable this option if the build
                                                                                     should be reported as failure if 1
                                                                                     or more critical defects are
                                                                                     reported during the analysis

  -d, --projectdir=projectdir                                                        The project directory should
                                                                                     contain a sfdx-project.json for
                                                                                     this command to succeed

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

  --version=version                                                                  [default: 6.22.0] The version of
                                                                                     PMD to be used for static analysis

EXAMPLE
  $ sfdx sfpowerscripts:AnalyzeWithPMD -b
  Output variable:
  sfpowerscripts_pmd_output_path
  <refname>_sfpowerscripts_pmd_output_path
```

_See code:_ [_lib/commands/sfpowerscripts/AnalyzeWithPMD.js_](https://github.com/Accenture/sfpowerscripts/blob/v0.0.22-alpha.1/lib/commands/sfpowerscripts/AnalyzeWithPMD.js)

### `sfpowerscripts:CreateDeltaPackage`

This task is used to create a delta package between two commits and bundle the created delta as as a deployable artifact. Please ensure that the SFDX CLI and sfpowerkit plugin are installed before using this task.

```text
USAGE
  $ sfdx sfpowerscripts:CreateDeltaPackage -n <string> -r <string> -v <string> [-t <string>] [-b] [-d <string>] [-x]
  [--bypassdirectories <string>] [--onlydifffor <string>] [--refname <string>] [--json] [--loglevel
  trace|debug|info|warn|error|fatal|TRACE|DEBUG|INFO|WARN|ERROR|FATAL]

OPTIONS
  -b, --buildartifactenabled                                                        Create a build artifact, so that
                                                                                    this pipeline can be consumed by a
                                                                                    release pipeline

  -d, --projectdir=projectdir                                                       The project directory should contain
                                                                                    a sfdx-project.json for this command
                                                                                    to succeed

  -n, --package=package                                                             (required) The name of the package

  -r, --revisionfrom=revisionfrom                                                   (required) Provide the full SHA
                                                                                    Commit ID, from where the diff
                                                                                    should start generating

  -t, --revisionto=revisionto                                                       If not set, the head commit ID of
                                                                                    the current branch is used

  -v, --versionname=versionname                                                     (required) Provide a meaningful name
                                                                                    such as the default value, so this
                                                                                    artifact can be identified in the
                                                                                    release

  -x, --generatedestructivemanifest                                                 Check this option to generate a
                                                                                    destructive manifest to be deployed

  --bypassdirectories=bypassdirectories                                             Ignore a comma seperated list of
                                                                                    directories that need to be ignored
                                                                                    while a diff is generated

  --json                                                                            format output as json

  --loglevel=(trace|debug|info|warn|error|fatal|TRACE|DEBUG|INFO|WARN|ERROR|FATAL)  [default: warn] logging level for
                                                                                    this command invocation

  --onlydifffor=onlydifffor                                                         Generate a comma seperated list of
                                                                                    directories that the diff should be
                                                                                    generated, Create a
                                                                                    sfdx-project.json to support
                                                                                    deployment

  --refname=refname                                                                 Reference name to be prefixed to
                                                                                    output variables

EXAMPLE
  $ sfdx sfpowerscripts:CreateDeltaPackage -n packagename -r 61635fb -t 3cf01b9 -v 1.2.10 -b
  Output variable:
  sfpowerscripts_delta_package_path
  <refname>_sfpowerscripts_delta_package_path
  sfpowerscripts_artifact_metadata_directory
  <refname>_sfpowerscripts_artifact_metadata_directory
```

_See code:_ [_lib/commands/sfpowerscripts/CreateDeltaPackage.js_](https://github.com/Accenture/sfpowerscripts/blob/v0.0.22-alpha.1/lib/commands/sfpowerscripts/CreateDeltaPackage.js)

### `sfpowerscripts:CreateSourcePackage`

This task simulates a packaging experience similar to unlocked packaging, just by writing the commit id to an artifact. It is basically to help with the release pipelines.

```text
USAGE
  $ sfdx sfpowerscripts:CreateSourcePackage -n <string> -v <string> [--refname <string>] [--json] [--loglevel
  trace|debug|info|warn|error|fatal|TRACE|DEBUG|INFO|WARN|ERROR|FATAL]

OPTIONS
  -n, --package=package
      (required) The name of the package

  -v, --versionnumber=versionnumber
      (required) The format is major.minor.patch.buildnumber . This will override the build number mentioned in the
      sfdx-project.json, Try considering the use of Increment Version Number task before this task

  --json
      format output as json

  --loglevel=(trace|debug|info|warn|error|fatal|TRACE|DEBUG|INFO|WARN|ERROR|FATAL)
      [default: warn] logging level for this command invocation

  --refname=refname
      Reference name to be prefixed to output variables

EXAMPLE
  $ sfdx sfpowerscripts:CreateSourcePackage -n packagename -v 1.5.10
  Output variable:
  sfpowerscripts_artifact_metadata_directory
  <refname>_sfpowerscripts_artifact_metadata_directory
```

_See code:_ [_lib/commands/sfpowerscripts/CreateSourcePackage.js_](https://github.com/Accenture/sfpowerscripts/blob/v0.0.22-alpha.1/lib/commands/sfpowerscripts/CreateSourcePackage.js)

### `sfpowerscripts:CreateUnlockedPackage`

Creates a new package version. Utilize this task in a package build for DX Unlocked Package.

```text
USAGE
  $ sfdx sfpowerscripts:CreateUnlockedPackage -n <string> [-b] [-k <string> | -x] [-v <string>] [--versionnumber
  <string>] [-f <string>] [-d <string>] [--enablecoverage] [-s] [--tag <string>] [--waittime <string>] [--refname
  <string>] [--json] [--loglevel trace|debug|info|warn|error|fatal|TRACE|DEBUG|INFO|WARN|ERROR|FATAL]

OPTIONS
  -b, --buildartifactenabled
      Create a build artifact, so that this pipeline can be consumed by a release pipeline

  -d, --projectdir=projectdir
      The project directory should contain a sfdx-project.json for this command to succeed

  -f, --configfilepath=configfilepath
      [default: config/project-scratch-def.json] Path in the current project directory containing  config file for the
      packaging org

  -k, --installationkey=installationkey
      Installation key for this package

  -n, --package=package
      (required) ID (starts with 0Ho) or alias of the package to create a version of

  -s, --isvalidationtobeskipped
      Skips validation of dependencies, package ancestors, and metadata during package version creation. Skipping
      validation reduces the time it takes to create a new package version, but package versions created without
      validation can’t be promoted.

  -v, --devhubalias=devhubalias
      [default: HubOrg] Provide the alias of the devhub previously authenticated, default value is HubOrg if using the
      Authenticate Devhub task

  -x, --installationkeybypass
      Bypass the requirement for having an installation key for this version of the package

  --enablecoverage
      Please note this command takes a longer time to compute, activating this on every packaging build might not
      necessary

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

EXAMPLE
  $ sfdx sfpowerscripts:CreateUnlockedPackage -n packagealias -b -x -v HubOrg --tag tagname
  Output variable:
  sfpowerscripts_package_version_id
  <refname>_sfpowerscripts_package_version_id
  sfpowerscripts_artifact_metadata_directory
  <refname>_sfpowerscripts_artifact_metadata_directory
```

_See code:_ [_lib/commands/sfpowerscripts/CreateUnlockedPackage.js_](https://github.com/Accenture/sfpowerscripts/blob/v0.0.22-alpha.1/lib/commands/sfpowerscripts/CreateUnlockedPackage.js)

### `sfpowerscripts:DeployDestructiveManifest`

Delete components in org according to destructive manifest - an empty package.xml will be automatically created, Read more about the task at [https://sfpowerscripts.com/tasks/deployment-tasks/deploy-destructive-maifest-to-an-org/](https://sfpowerscripts.com/tasks/deployment-tasks/deploy-destructive-maifest-to-an-org/)

```text
USAGE
  $ sfdx sfpowerscripts:DeployDestructiveManifest [-u <string>] [-m <string>] [-t <string>] [-f <string>] [--json]
  [--loglevel trace|debug|info|warn|error|fatal|TRACE|DEBUG|INFO|WARN|ERROR|FATAL]

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

EXAMPLES
  $ sfdx sfpowerscripts:DeployDestructiveManifest -u scratchorg -m Text -t "<?xml version="1.0" encoding="UTF-8"?>
  <Package
  xmlns="http://soap.sforce.com/2006/04/metadata"><types><members>myobject__c</members><name>CustomObject</name></types>
  </Package>"
```

_See code:_ [_lib/commands/sfpowerscripts/DeployDestructiveManifest.js_](https://github.com/Accenture/sfpowerscripts/blob/v0.0.22-alpha.1/lib/commands/sfpowerscripts/DeployDestructiveManifest.js)

### `sfpowerscripts:DeploySource`

Deploy source to org using mdapi based deploy \(converts source to mdapi and use mdapi deployment\).

```text
USAGE
  $ sfdx sfpowerscripts:DeploySource [-u <string>] [-d <string>] [--sourcedir <string>] [--waittime <string>] [-c] [-f
  <string>] [-l <string>] [--specifiedtests <string>] [--apextestsuite <string>] [-b] [--refname <string>] [--json]
  [--loglevel trace|debug|info|warn|error|fatal|TRACE|DEBUG|INFO|WARN|ERROR|FATAL]

OPTIONS
  -b, --istobreakbuildifempty
      Uncheck this field, to allow for empty folders not to break build, useful in the case of pre/post step uniformity
      across projects

  -c, --checkonly
      Validate a deployment, but don't save to the org, Use this for Stage 1/2 CI Run's

  -d, --projectdir=projectdir
      The  directory should contain a sfdx-project.json for this command to succeed

  -f, --validationignore=validationignore
      [default: .forceignore] Validation only deployment has issues with certain metadata such as apexttestsuite, create a
      different file similar to .forceignore and use it during validate only deployment

  -l, --testlevel=NoTestRun|RunSpecifiedTests|RunApexTestSuite|RunLocalTests|RunAllTestsInOrg
      [default: NoTestRun] The test level of the test that need to be executed when the code is to be deployed

  -u, --targetorg=targetorg
      [default: scratchorg] Alias or username of the target org where the code should be deployed

  --apextestsuite=apextestsuite
      Name of the Apex Test Suite that needs to be executed during this deployment

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

EXAMPLE
  $ sfdx sfpowerscripts:DeploySource -u scratchorg --sourcedir force-app -c
  Output variable:
  sfpowerkit_deploysource_id
  <refname_sfpowerkit_deploysource_id
```

_See code:_ [_lib/commands/sfpowerscripts/DeploySource.js_](https://github.com/Accenture/sfpowerscripts/blob/v0.0.22-alpha.1/lib/commands/sfpowerscripts/DeploySource.js)

### `sfpowerscripts:ExportSource`

Export source from any org for storing to backup or further analysis. Please ensure that the SFDX CLI and sfpowerkit plugin are installed before using this task.

```text
USAGE
  $ sfdx sfpowerscripts:ExportSource [-u <string>] [-d <string>] [--quickfilter <string>] [-x] [-e] [--refname <string>]
  [--json] [--loglevel trace|debug|info|warn|error|fatal|TRACE|DEBUG|INFO|WARN|ERROR|FATAL]

OPTIONS
  -d, --sourcedir=sourcedir                                                         [default: metadata] The directory to
                                                                                    which the source should be exported
                                                                                    to

  -e, --isunzipenabled                                                              Unzip the exported metadata/source
                                                                                    from the zip into the provided
                                                                                    folder

  -u, --targetorg=targetorg                                                         [default: scratchorg] Alias or
                                                                                    username of the target org where
                                                                                    metadata is to be retrieved

  -x, --ismanagedpackagestobeexcluded                                               Exclude managed package components
                                                                                    from the export

  --json                                                                            format output as json

  --loglevel=(trace|debug|info|warn|error|fatal|TRACE|DEBUG|INFO|WARN|ERROR|FATAL)  [default: warn] logging level for
                                                                                    this command invocation

  --quickfilter=quickfilter                                                         Comma separated values  of metadata
                                                                                    type, member or file names to be
                                                                                    excluded while building the manifest

  --refname=refname                                                                 Reference name to be prefixed to
                                                                                    output variables

EXAMPLE
  $ sfdx sfpowerscripts:ExportSource -u scratchorg -d metadata -x -e
  Output variable:
  sfpowerscripts_exportedsource_zip_path
  <refname>_sfpowerscripts_exportedsource_zip_path
```

_See code:_ [_lib/commands/sfpowerscripts/ExportSource.js_](https://github.com/Accenture/sfpowerscripts/blob/v0.0.22-alpha.1/lib/commands/sfpowerscripts/ExportSource.js)

### `sfpowerscripts:IncrementBuildNumber`

Increment the selected version counter by one and adds a commit to to your repository. This task does not push the change to the repository. If a push to the repository is required, include a step after the package is created to push this commit to the repository.

Please note this task skips all the options if it figures a .NEXT in the build number for an unlocked package

```text
USAGE
  $ sfdx sfpowerscripts:IncrementBuildNumber [--segment <string>] [-a -r <string>] [-n <string>] [-d <string>] [-c]
  [--refname <string>] [--json] [--loglevel trace|debug|info|warn|error|fatal|TRACE|DEBUG|INFO|WARN|ERROR|FATAL]

OPTIONS
  -a, --appendbuildnumber
      Set the build segment of the version number to the build number rather than incremenenting

  -c, --commitchanges
      Mark this if you want to commit the sfdx-project json to the repository, Please note this will not push to the repo
      only commits in the local checked out repo, You would need to have a push to the repo at the end of the packaging
      task if everything is successfull

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

EXAMPLE
  $ sfdx IncrementBuildNumber --segment BuildNumber -n packagename -c
  Output variable:
  sfpowerscripts_incremented_project_version
  <refname>_sfpowerscripts_incremented_project_version
```

_See code:_ [_lib/commands/sfpowerscripts/IncrementBuildNumber.js_](https://github.com/Accenture/sfpowerscripts/blob/v0.0.22-alpha.1/lib/commands/sfpowerscripts/IncrementBuildNumber.js)

### `sfpowerscripts:InstallUnlockedPackage`

Installs an unlocked package using sfpowerscripts metadata.

```text
USAGE
  $ sfdx sfpowerscripts:InstallUnlockedPackage [-n <string>] [-u <string>] [-v <string> | -i] [-k <string>] [-a]
  [--securitytype <string>] [--upgradetype <string>] [--waittime <string>] [--publishwaittime <string>] [--json]
  [--loglevel trace|debug|info|warn|error|fatal|TRACE|DEBUG|INFO|WARN|ERROR|FATAL]

OPTIONS
  -a, --apexcompileonlypackage                                                      Each package installation triggers a
                                                                                    compilation of apex, flag to trigger
                                                                                    compilation of package only

  -i, --packageinstalledfrom                                                        automatically retrieve the version
                                                                                    ID of the package to be installed,
                                                                                    from the build artifact

  -k, --installationkey=installationkey                                             installation key for key-protected
                                                                                    package

  -n, --package=package                                                             Name of the package to be installed

  -u, --envname=envname                                                             Alias/User Name of the target
                                                                                    environment

  -v, --packageversionid=packageversionid                                           manually input package version Id of
                                                                                    the package to be installed

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
  $ sfdx InstallUnlockedPackage -n packagename -u sandboxalias -i
```

_See code:_ [_lib/commands/sfpowerscripts/InstallUnlockedPackage.js_](https://github.com/Accenture/sfpowerscripts/blob/v0.0.22-alpha.1/lib/commands/sfpowerscripts/InstallUnlockedPackage.js)

### `sfpowerscripts:TriggerApexTest`

Triggers an asynchronous apex unit test in an org. Please ensure that the SFDX CLI and sfpowerkit plugin are installed before using this task.

```text
USAGE
  $ sfdx sfpowerscripts:TriggerApexTest [-u <string>] [-l <string>] [-s] [--specifiedtests <string>] [--apextestsuite
  <string>] [--waittime <string>] [--json] [--loglevel
  trace|debug|info|warn|error|fatal|TRACE|DEBUG|INFO|WARN|ERROR|FATAL]

OPTIONS
  -l, --testlevel=RunSpecifiedTests|RunApexTestSuite|RunLocalTests|RunAllTestsInOrg  [default: RunLocalTests] The test
                                                                                     level of the test that need to be
                                                                                     executed when the code is to be
                                                                                     deployed

  -s, --synchronous                                                                  Select an option if the tests are
                                                                                     to be run synchronously

  -u, --targetorg=targetorg                                                          [default: scratchorg] username or
                                                                                     alias for the target org; overrides
                                                                                     default target org

  --apextestsuite=apextestsuite                                                      comma-separated list of Apex test
                                                                                     suite names to run

  --json                                                                             format output as json

  --loglevel=(trace|debug|info|warn|error|fatal|TRACE|DEBUG|INFO|WARN|ERROR|FATAL)   [default: warn] logging level for
                                                                                     this command invocation

  --specifiedtests=specifiedtests                                                    comma-separated list of Apex test
                                                                                     class names or IDs and, if
                                                                                     applicable, test methods to run

  --waittime=waittime                                                                [default: 60] wait time for command
                                                                                     to finish in minutes

EXAMPLE
  $ sfdx TriggerApexTest -u scratchorg -l RunLocalTests -s
```

_See code:_ [_lib/commands/sfpowerscripts/TriggerApexTest.js_](https://github.com/Accenture/sfpowerscripts/blob/v0.0.22-alpha.1/lib/commands/sfpowerscripts/TriggerApexTest.js)

### `sfpowerscripts:ValidateApexCoverage`

Validates apex test coverage in the org. Please ensure that the SFDX CLI and sfpowerkit plugin are installed before using this task.

```text
USAGE
  $ sfdx sfpowerscripts:ValidateApexCoverage -t <string> [-u <string>] [--json] [--loglevel
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
  $ sfdx sfpowerscripts:ValidateApexCoverage -u scratchorg -t 80
```

_See code:_ [_lib/commands/sfpowerscripts/ValidateApexCoverage.js_](https://github.com/Accenture/sfpowerscripts/blob/v0.0.22-alpha.1/lib/commands/sfpowerscripts/ValidateApexCoverage.js) 

