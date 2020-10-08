# sfpowerscripts

Simple wrappers around sfdx commands to help set up CI/CD quickly. These commands are universal and may be used on any automation platform, as long as a shell process is available for executing the commands.

## Installation
The [SFDX CLI](https://developer.salesforce.com/docs/atlas.en-us.sfdx_setup.meta/sfdx_setup/sfdx_setup_install_cli.htm) and [sfpowerkit plugin](https://github.com/Accenture/sfpowerkit) are required for this plugin to work. If you have not already done so, please install both of these before continuing.

To install the sfpowerscripts plugin, run the following command:
```
$ sfdx plugins:install @dxatscale/sfpowerscripts
```
For automated installations as part of a CI process or Dockerfile:
```
$ echo 'y' | sfdx plugins:install @dxatscale/sfpowerscripts
```
  <!-- usage -->
## Usage
```sh-session
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

## Output variables
Many of the commands listed below will output variables which may be consumed as flag inputs in subsequent commands. Simply pass the **variable name** to the command, and it will be substituted with the corresponding value, at runtime.

Eg.
```
  $ sfdx sfpowerscripts:IncrementBuildNumber -n <mypackage>

    ...

    Output variable:
    sfpowerscripts_incremented_project_version=1.0.0.1

  $ sfdx sfpowerscripts:CreateSourcePackage -n <mypackage> --versionnumber sfpowerscripts_incremented_project_version
```

The following output variables are currently supported:
* sfpowerscripts_incremented_project_version
* sfpowerscripts_artifact_directory
* sfpowerscripts_artifact_metadata_directory
* sfpowerscripts_delta_package_path
* sfpowerscripts_package_version_id
* sfpowerscripts_package_version_number
* sfpowerscripts_pmd_output_path
* sfpowerscripts_exportedsource_zip_path
* sfpowerkit_deploysource_id

If you require access to the variables at the shell layer, you may do so using the [readVars](https://github.com/Accenture/sfpowerscripts/tree/develop/packages/sfpowerscripts-cli/scripts) helper script, which is included as part of this package.


### Reference name
Commands that output variables optionally accept a `--refname` flag that prefixes output variables with a user-specified string. The prefix is intended as a variable namespace that allows the same command to be invoked multiple times without overwriting the output variables.

```
$ sfdx sfpowerscripts:CreateUnlockedPackage --refname core -n core_package -b -x -v DevHub

Output variables:
core_sfpowerscripts_package_version_id=04t2v000007X2YRAA0

$ sfdx sfpowerscripts:CreateUnlockedPackage --refname utility -n utility_package -b -x -v Devhub

Output variables:
utility_sfpowerscripts_package_version_id=04t2v000007X2YWAA0
```


<!-- usagestop -->
  ## Commands
  <!-- commands -->
* [`sfpowerscripts:AnalyzeWithPMD`](#sfpowerscriptsanalyzewithpmd)
* [`sfpowerscripts:CreateDeltaPackage`](#sfpowerscriptscreatedeltapackage)
* [`sfpowerscripts:CreateSourcePackage`](#sfpowerscriptscreatesourcepackage)
* [`sfpowerscripts:CreateUnlockedPackage`](#sfpowerscriptscreateunlockedpackage)
* [`sfpowerscripts:DeployDestructiveManifest`](#sfpowerscriptsdeploydestructivemanifest)
* [`sfpowerscripts:DeploySource`](#sfpowerscriptsdeploysource)
* [`sfpowerscripts:ExportSource`](#sfpowerscriptsexportsource)
* [`sfpowerscripts:GenerateChangelog [BETA]`](#sfpowerscriptsgeneratechangelog)
* [`sfpowerscripts:IncrementBuildNumber`](#sfpowerscriptsincrementbuildnumber)
* [`sfpowerscripts:InstallUnlockedPackage`](#sfpowerscriptsinstallunlockedpackage)
* [`sfpowerscripts:TriggerApexTest`](#sfpowerscriptstriggerapextest)
* [`sfpowerscripts:ValidateApexCoverage`](#sfpowerscriptsvalidateapexcoverage)

## `sfpowerscripts:AnalyzeWithPMD`

This task is used to run a static analysis of the apex classes and triggers using PMD. Please ensure that the SFDX CLI and sfpowerkit plugin are installed before using this task.

```
USAGE
  $ sfdx sfpowerscripts:AnalyzeWithPMD [--sourcedir <string>] [--ruleset <string>] [--rulesetpath <string>] [--format
  <string>] [-o <string>] [--version <string>] [-b] [-d <string>] [--refname <string>] [--json] [--loglevel
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

  --version=version                                                                  [default: 6.22.0] The version of
                                                                                     PMD to be used for static analysis

EXAMPLE
  $ sfdx sfpowerscripts:AnalyzeWithPMD -b
  Output variable:
  sfpowerscripts_pmd_output_path
  <refname>_sfpowerscripts_pmd_output_path
```

## `sfpowerscripts:CreateDeltaPackage`

This task is used to create a delta package between two commits and bundle the created delta as as a deployable artifact. Please ensure that the SFDX CLI and sfpowerkit plugin are installed before using this task.

```
USAGE
  $ sfdx sfpowerscripts:CreateDeltaPackage -n <string> -r <string> -v <string> [-t <string>] [-b] [-d <string>] [-x]
  [--bypassdirectories <string>] [--onlydifffor <string>] [--refname <string>] [--json] [--loglevel
  trace|debug|info|warn|error|fatal|TRACE|DEBUG|INFO|WARN|ERROR|FATAL]

OPTIONS

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

  --artifactdir=artifactdir                                                         [default: artifacts] The directory
                                                                                    where the artifact is to be written

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

  --repourl=repourl                                                                 Custom source repository URL to use in
                                                                                    artifact metadata, overrides origin URL
                                                                                    defined in git config

EXAMPLES
  $ sfdx sfpowerscripts:CreateDeltaPackage -n <packagename> -r <61635fb> -t <3cf01b9> -v <version> -b

  Output variable:
  sfpowerscripts_delta_package_path
  <refname>_sfpowerscripts_delta_package_path
  sfpowerscripts_artifact_metadata_directory
  <refname>_sfpowerscripts_artifact_metadata_directory
  sfpowerscripts_artifact_directory
  <refname>_sfpowerscripts_artifact_directory
```

## `sfpowerscripts:CreateSourcePackage`

This task simulates a packaging experience similar to unlocked packaging - creating an artifact that consists of the metadata (e.g. commit Id), source code & an optional destructive manifest. The artifact can then be consumed by release pipelines, to deploy the package.

```
USAGE
  $ sfdx sfpowerscripts:CreateSourcePackage -n <string> -v <string> [--refname <string>] [--json] [--loglevel
  trace|debug|info|warn|error|fatal|TRACE|DEBUG|INFO|WARN|ERROR|FATAL]

OPTIONS

  -n, --package=package
      (required) The name of the package

  -r, --repourl=repourl
      Custom source repository URL to use in artifact metadata, overrides origin URL defined in git config

  -v, --versionnumber=versionnumber
      (required) The format is major.minor.patch.buildnumber . This will override the build number mentioned in the
      sfdx-project.json, Try considering the use of Increment Version Number task before this task

  --apextestsuite=apextestsuite
      Apex Test Suite that needs to be associated with the source package, Source packages when deployed to
      production require each individual classes in the package to have more than 75% coverage, Hence this
      apex test task should cover all the classes

  --artifactdir=artifactdir
      [default: artifacts] The directory where the artifact is to be written

  --destructivemanifestfilepath=destructivemanifestfilepath
      Path to a destructiveChanges.xml, mentioning any metadata that need to be deleted before the contents
      in the source package need to be installed in the org

  --diffcheck
      Only build when the package has changed

  --gittag
      Tag the current commit ID with an annotated tag containing the package name and version - does not
      push tag

  --json
      format output as json

  --loglevel=(trace|debug|info|warn|error|fatal|TRACE|DEBUG|INFO|WARN|ERROR|FATAL)
      [default: warn] logging level for this command invocation

  --refname=refname
      Reference name to be prefixed to output variables

EXAMPLES
  $ sfdx sfpowerscripts:CreateSourcePackage -n <mypackage> -v <version> --refname <name>
  $ sfdx sfpowerscripts:CreateSourcePackage -n <mypackage> -v <version> --diffcheck --gittag

  Output variable:
  sfpowerscripts_artifact_metadata_directory
  <refname>_sfpowerscripts_artifact_metadata_directory
  sfpowerscripts_artifact_directory
  <refname>_sfpowerscripts_artifact_directory
  sfpowerscripts_package_version_number
  <refname>_sfpowerscripts_package_version_number
```

## `sfpowerscripts:CreateUnlockedPackage`

Creates a new package version, and generates an artifact that consists of the metadata (e.g. version Id). The artifact can then be consumed by release pipelines, to install the unlocked package. Utilize this task in a package build for DX Unlocked Package.

```
USAGE
  $ sfdx sfpowerscripts:CreateUnlockedPackage -n <string> [-b] [-k <string> | -x] [-v <string>] [--versionnumber
  <string>] [-f <string>] [-d <string>] [--enablecoverage] [-s] [--tag <string>] [--waittime <string>] [--refname
  <string>] [--json] [--loglevel trace|debug|info|warn|error|fatal|TRACE|DEBUG|INFO|WARN|ERROR|FATAL]

OPTIONS
  -b, --buildartifactenabled
      [DEPRECATED - always generate artifact] Create a build artifact, so that this pipeline can be consumed by a release pipeline

  -f, --configfilepath=configfilepath
      [default: config/project-scratch-def.json] Path in the current project directory containing  config file for the
      packaging org

  -k, --installationkey=installationkey
      Installation key for this package

  -n, --package=package
      (required) ID (starts with 0Ho) or alias of the package to create a version of

  -r --repourl=repourl
      Custom source repository URL to use in artifact metadata, overrides origin URL defined in git config

  -s, --isvalidationtobeskipped
      Skips validation of dependencies, package ancestors, and metadata during package version creation. Skipping
      validation reduces the time it takes to create a new package version, but package versions created without
      validation can’t be promoted.

  -v, --devhubalias=devhubalias
      [default: HubOrg] Provide the alias of the devhub previously authenticated, default value is HubOrg if using the
      Authenticate Devhub task

  -x, --installationkeybypass
      Bypass the requirement for having an installation key for this version of the package

  --artifactdir=artifactdir
      [default: artifacts] The directory where the artifact is to be written

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
  $ sfdx sfpowerscripts:CreateUnlockedPackage -n <packagealias> -b -x -v <devhubalias> --refname <name>
  $ sfdx sfpowerscripts:CreateUnlockedPackage -n <packagealias> -b -x -v <devhubalias> --diffcheck --gittag

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



## `sfpowerscripts:DeployDestructiveManifest`

Delete components in org according to destructive manifest - an empty package.xml will be automatically created, Read more about the task at  https://sfpowerscripts.com/tasks/deployment-tasks/deploy-destructive-maifest-to-an-org/

```
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

  --skiponmissingmanifest
      Skip if unable to find destructive manfiest file
EXAMPLES
  $ sfdx sfpowerscripts:DeployDestructiveManifest -u scratchorg -m Text -t "<?xml version="1.0" encoding="UTF-8"?>
  <Package
  xmlns="http://soap.sforce.com/2006/04/metadata"><types><members>myobject__c</members><name>CustomObject</name></types>
  </Package>"
```



## `sfpowerscripts:DeploySource`

Deploy source to org using mdapi based deploy (converts source to mdapi and use mdapi deployment).

```
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

EXAMPLE
  $ sfdx sfpowerscripts:DeploySource -u scratchorg --sourcedir force-app -c
  Output variable:
  sfpowerkit_deploysource_id
  <refname_sfpowerkit_deploysource_id
```



## `sfpowerscripts:ExportSource`

Export source from any org for storing to backup or further analysis. Please ensure that the SFDX CLI and sfpowerkit plugin are installed before using this task.

```
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



## `sfpowerscripts:GenerateChangelog [BETA]`

Generates release changelog, providing a summary of artifact versions, work items and commits introduced in a release. Creates a release definition based on artifacts contained in the artifact directory, and compares it to previous release definition in changelog stored on a source repository

```
USAGE
  $ sfdx sfpowerscripts:GenerateChangelog -d <directory> -n <string> -w <string> -r <string> -b <string> [--limit <integer>] [--workitemurl
  <string>] [--json] [--loglevel trace|debug|info|warn|error|fatal|TRACE|DEBUG|INFO|WARN|ERROR|FATAL]

OPTIONS
  -b, --branchname=branchname                                                       (required) Repository branch in which the changelog files are
                                                                                    located

  -d, --artifactdir=artifactdir                                                     (required) [default: artifacts] Directory containing
                                                                                    sfpowerscripts artifacts

  -n, --releasename=releasename                                                     (required) Name of the release for which to generate
                                                                                    changelog

  -r, --repourl=repourl                                                             (required) Repository in which the changelog files are
                                                                                    located. Assumes user is already authenticated.

  -w, --workitemfilter=workitemfilter                                               (required) Regular expression used to search for work items
                                                                                    (user stories) introduced in release

  --json                                                                            format output as json

  --limit=limit                                                                     limit the number of releases to display in changelog markdown

  --loglevel=(trace|debug|info|warn|error|fatal|TRACE|DEBUG|INFO|WARN|ERROR|FATAL)  [default: warn] logging level for this command invocation

  --workitemurl=workitemurl                                                         Generic URL for work items. Each work item ID will be
                                                                                    appended to the URL, providing quick access to work items

EXAMPLE
  $ sfdx sfpowerscripts:GenerateChangelog -n <releaseName> -d path/to/artifact/directory -w <regexp> -r <repoURL> -b <branchName>
```

## `sfpowerscripts:IncrementBuildNumber`

Increment the selected version counter by one and optionally commit changes to sfdx-project.json. This command does not push changes to the source repository.

Please note this task skips all the options if it figures a .NEXT in the build number for an unlocked package

```
USAGE
  $ sfdx sfpowerscripts:IncrementBuildNumber [--segment <string>] [-a -r <string>] [-n <string>] [-d <string>] [-c]
  [--refname <string>] [--json] [--loglevel trace|debug|info|warn|error|fatal|TRACE|DEBUG|INFO|WARN|ERROR|FATAL]

OPTIONS
  -a, --appendbuildnumber
      Set the build segment of the version number to the build number rather than incremenenting

  -c, --commitchanges
      Mark this if you want to commit the modified sfdx-project json, Please note this will not push to the repo
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



## `sfpowerscripts:InstallUnlockedPackage`

Installs an unlocked package using sfpowerscripts metadata.

```
USAGE
  $ sfdx sfpowerscripts:InstallUnlockedPackage [-n <string>] [-u <string>] [-v <string> | -i] [-k <string>] [-a]
  [--securitytype <string>] [--upgradetype <string>] [--waittime <string>] [--publishwaittime <string>] [--json]
  [--loglevel trace|debug|info|warn|error|fatal|TRACE|DEBUG|INFO|WARN|ERROR|FATAL]

OPTIONS
  -a, --apexcompileonlypackage                                                      Each package installation triggers a
                                                                                    compilation of apex, flag to trigger
                                                                                    compilation of package only

  -f, --skipifalreadyinstalled                                                      Skip the package installation if the
                                                                                    package is already installed in the org

  -i, --packageinstalledfrom                                                        automatically retrieve the version
                                                                                    ID of the package to be installed,
                                                                                    from the build artifact

  -k, --installationkey=installationkey                                             installation key for key-protected
                                                                                    package

  -n, --package=package                                                             Name of the package to be installed

  -s, --skiponmissingartifact                                                       Skip package installation if the build
                                                                                    artifact is missing.
                                                                                    Enable this if artifacts are only
                                                                                    being created for modified packages

  -u, --targetorg=targetorg                                                         Alias/User Name of the target
                                                                                    environment

  -v, --packageversionid=packageversionid                                           manually input package version Id of
                                                                                    the package to be installed

  --artifactdir                                                                     [default: artifacts] The directory
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
  $ sfdx InstallUnlockedPackage -n packagename -u sandboxalias -i
```



## `sfpowerscripts:TriggerApexTest`

Triggers Apex unit test in an org. Supports test level RunAllTestsInPackage, which optionally allows validation of individual class code coverage

```
USAGE
  $ sfdx sfpowerscripts:TriggerApexTest [-u <string>] [-l <string>] [-s] [--specifiedtests <string>] [--apextestsuite
  <string>] [--waittime <string>] [--json] [--loglevel
  trace|debug|info|warn|error|fatal|TRACE|DEBUG|INFO|WARN|ERROR|FATAL]

OPTIONS

  -c, --validateindividualclasscoverage                                              Enable code coverage validation for
                                                                                     individual classes, when test level is
                                                                                     RunAllTestsInPackage

  -l, --testlevel=RunSpecifiedTests|RunApexTestSuite|RunLocalTests|RunAllTestsInOrg|RunAllTestsInPackage
                                                                                     [default: RunLocalTests] The test
                                                                                     level of the test that need to be
                                                                                     executed when the code is to be
                                                                                     deployed

  -n, --package=package                                                              Name of the package to run
                                                                                     tests. Required when test level is
                                                                                     RunAllTestsInPackage

  -p, --coveragepercent=coveragepercent                                              [default: 75] Minimum coverage percentage
                                                                                     required for each class in package

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
  $ sfdx sfpowerscripts:TriggerApexTest -u scratchorg -l RunLocalTests -s
  $ sfdx sfpowerscripts:TriggerApexTest -u scratchorg -l RunAllTestsInPackage -n <mypackage> -c
```

## `sfpowerscripts:ValidateApexCoverage`

Validates  apex test coverage in the org. Please ensure that the SFDX CLI and sfpowerkit plugin are installed before using this task.

```
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


<!-- commandsstop -->
