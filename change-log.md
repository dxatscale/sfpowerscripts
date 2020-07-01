# Change Log

## Release 13.8000.9

May 16, 2020 minor

This release is a hotfix for Increment Build Number Task, as the earlier task was not reflecting the correct build task in the package and sample pipelines.

[**✎** Update Entry](cloudcannon:collections/_posts/2020-05-16-release-13-8000-9.md)

## Release 13.8000.7

May 16, 2020 major

sfpowerscripts has been migrated as an Accenture supported/hosted open source project.

**Features:**

* We have been refactoring the internal implementation to support a sfdx cli plugin for ease of use in other CI/CD systems other than Azure Pipelines. Due to this the entire task versions have been updated and refactored to use the new structure
* The CI/CD pipelines of the program was rewritten to use lerna and support deploying of npm package

**Fixes:**

\*  None

[**✎** Update Entry](cloudcannon:collections/_posts/2020-05-16-release-13-8000-7.md)

## Release 11.0.59

April 03, 2020 major

This release introduces

**Features:**

\* \#97 Security Token is ensured to be an optional component for Service Connection

\#73 Better Error Handling and integration with Github, Deploy Source/Apex Test Task error results are published to Github checks. Please note this is available only for YAML pipelines

\#117 Update apex test task for github anottations

\#104 Artifact metadata schema is modified to support for multiple artifacts produced by a single stage in a build pipeline.

**Fixes:**

\* \#99 Deploy Source unable to find apex test suite

\#119 Create Packages Tasks are failing when mulitple runs of the same task are triggered

[**✎** Update Entry](cloudcannon:collections/_posts/2020-04-03-release-11-0-59.md)

## Release 11.0.59

April 02, 2020 major

This release introduces

**Features:**

 \#97 Security Token is ensured to be an optional component for Service Connection

\#73 Better Error Handling and integration with Github, Deploy Source/Apex Test Task error results are published to Github checks. Please note this is available only for YAML pipelines

\#117 Update apex test task for github anottations

\#104 Artifact metadata schema is modified to support for multiple artifacts produced by a single stage in a build pipeline.

**Fixes:**

\* \#99 Deploy Source unable to find apex test suite

\#119 Create Packages Tasks are failing when mulitple runs of the same task are triggered

[**✎** Update Entry](cloudcannon:collections/_posts/2020-04-02-release-11-0-59.md)

## Release 10.0.45

February 27, 2020 major

This release introduces

**Features:**

\* \#86 YAML Based Pipelines for releasing sfpowerscripts with test tasks. This is a first iteration, more tests are added and a full regression will be done for all the tasks every release

\#61 A isToBreakBuild flag was added to Deploy Source to Org task, as a helper function when used as a pre/post deployment task. The idea is the build doesnt need to fail if the metadata folder is empty in certain cases

\#83 PMD Dashboard is overhauled with scrolling and other fixes

**Fixes:**

\* \#93 Fixed Tagging while creating unlocked packages

\* \#87 Fixed Issues with apex task not getting triggered in release pipeliens

[**✎** Update Entry](cloudcannon:collections/_posts/2020-02-27-release-10-0-45.md)

## Release 8.0.6

January 14, 2020 major

This release introduces some major changes to the plugin

**Features:**

\*  Previous versions of deprecated tasks such as Authenticate an Org, Install SFDX CLI and Manage ScratchOrg has been removed. which means the pipelines will start complaining if you are still using these tasks after the update.  Please start using the newer versions of these tasks.

\* The plugin also requires new permissions for this upgrade to work such as ability to manage and execute builds, ability to manage release pipelines and service connections. This is essential as we start building UI extensions going forward.

\* Introducing the first version of PMD Analysis Tab, that will light up if you have a PMD analysis task on your build definition. It will currently display the defect count and some details. Subsequent versions will feature more features onto this tab such as a trend history. The PMD tasks have to be updated to 4.3.0

\* Authenticate an Org task now supports a Service Connection using Basic Auth, which can be set project wide. This removes the need for variable groups / variables to be linked to pipelines and making the management whole lot easier.

\* Install SFDX CLI task now lets you choose Salesforce API version which will be applied globally for all the execution. This will let you create preview scratch orgs and so on.

**Fixes:**

\* None

[**✎** Update Entry](cloudcannon:collections/_posts/2020-01-14-release-8-0-6.md)

## Release 7.0.3

January 02, 2020 major

This release is the first milestone where integration with Azure Pipelines UI is hapening to some of the tasks.

**Features:**

\* [\#](https://github.com/azlamsalam/sfpowerscripts/issues/15)[15](https://sfpowerscripts.com/changelog/__notset__) Manage Scratch Org updated to v5. 

*  Initial version of  Review Scratch Org’s in Build Summary Tab
* Post Job Action which makes the delete scratch org task optional depending on the maintain action specified in the create task.

\* [\#](https://github.com/azlamsalam/sfpowerscripts/issues/44)[44](https://sfpowerscripts.com/changelog/__notset__)  Trigger Apex Test Task updated to v3

* Test Reports are now integrated in the Build Summary Tab

**Fixes:**

\* None

[**✎** Update Entry](cloudcannon:collections/_posts/2020-01-02-release-7-0-3.md)

## Release 6.0.13

December 23, 2019 major

This release introduces

**Features:**

\* Supports Hosted Windows Agents, which means sfpowerscripts can be used along with hundreds of build tasks that are written in powershell

\* Install SFDX CLI task now supports installation of other sfdx plugins

\* Increment Push Number of a package updated to support pushing the changes to repository with different conditon modes. Read about it [here](https://sfpowerscripts.com/tasks/packaging-tasks/increment%20version%20number%20of%20a%20package/)

**Fixes:**

\* Minor Fixes to documentation

[**✎** Update Entry](cloudcannon:collections/_posts/2019-12-23-release-6-0-13.md)

## Release 5.0.5

December 09, 2019 minor

This release introduces

**Features:**

\* None

**Fixes:**

\* Hotfix for Package Version Create command failing when an exception is reported

[**✎** Update Entry](cloudcannon:collections/_posts/2019-12-09-release-5-0-5.md)

## Release 5.0.2

December 09, 2019 major

This release introduces

**Features:**

\* Introduces [\#31](https://github.com/azlamsalam/sfpowerscripts/issues/31) **Service Connection based authentication for git based tasks.**   
   - Checkout Build Artifacts updated to 6.0.0, and supports service credential based authentication for GitHub, GitHub Enterprise, Bitbucket Cloud and PAT based authentication for other Version Control Providers

\* Introduces [\#3](https://github.com/azlamsalam/sfpowerscripts/issues/31)[5](https://github.com/azlamsalam/sfpowerscripts/issues/35) **Code Coverage Validation for 2GP Package**  
   - A new task [Validate Code Coverage for Package](https://sfpowerscripts.com/tasks/testing%20tasks/validate%20code%20coverage%20package/) is introduced. This is building on the earlier update of 4.0.0 Create Unlocked package, which added capability to enabled code coverage option

**Fixes:**

\*  Fixes to documentation

[**✎** Update Entry](cloudcannon:collections/_posts/2019-12-09-release-5-0-2.md)

## Release 4.0.1

November 29, 2019 major

This release features an inclusion of an optional telemetry component \(activated by default\) on all task to capture the usage metrics and exception.

The information captured is available in this code snippet at  
[ ](https://sfpowerscripts.com/changelog/__notset__)[https://github.com/azlamsalam/sfpowerscripts/blob/master/BuildTasks/Common/AppInsights.ts](https://github.com/azlamsalam/sfpowerscripts/blob/master/BuildTasks/Common/AppInsights.ts)

Due to this change, all task versions is incremented and will be updated in the docs to reflect the same.

**Features:**

\* Optional Telemetry for tracking usage for all tasks

**Fixes:**

\* None

[**✎** Update Entry](cloudcannon:collections/_posts/2019-11-29-release-4-0-1.md)

## Release 3.0.19

November 24, 2019 major

This release features several changes. Please read the following summary

**Features:**

\* Introduction of package:promote command, This task can be used to  Promote a package version to released status. Read about the task [here](https://sfpowerscripts.com/tasks/packaging-tasks/promote%20an%20unlocked%20package/)

\* Code Coverage support in creation of unlocked package task. The task supports the code coverage parameter to display the coverage of the org. An upcoming release will feature a taks for validating the coverage value, which currently is available when using the command sfdx force:package:version:list –verbose

\* Introduction of task for deploying destructive manifest. This task greatly simplifies the work that needs to be done during the creation of a pipeline jus t deploy destructive changes, rather than along with regular deployment. Read info about this task [here](https://sfpowerscripts.com/tasks/deployment-tasks/deploy%20destructive%20manifest%20to%20an%20org/)

\*  Due to inconsistencies in id’s of the the following tasks \( it is being fixed to support yaml based builds as incorrect id’s were creating sore eye’s everywhere when authoring pipelines \), the following tasks had to be deprecated

1. Install SFDX and SFPowerkit - A new version of this task with a different ID is available, Read [here](https://sfpowerscripts.com/tasks/common-utility-tasks/install%20sfdx%20cli/).
2. Create/Delete a Scratch Org - A new version of this task with a different ID is available, Read [here](https://sfpowerscripts.com/tasks/common-utility-tasks/create%20and%20delete%20a%20scratch%20org/)
3. Authenticate an Org - A new version of this task with a different ID is available, Read [here](https://sfpowerscripts.com/tasks/common-utility-tasks/authenticate%20an%20org/)

**Fixes:**

\* Minor fixes in formatting and other UI fixes.

[**✎** Update Entry](cloudcannon:collections/_posts/2019-11-24-release-3-0-19.md)

## Release 2.0.23

October 16, 2019 major

This release has the following updates

**Features:**

\* Code Analysis using PMD. This task uses the newly introduced command in sfpowerkit to analyze static code analysis of Apex classes and triggers using PMD

**Fixes:**

\* Minor task description fixes

[**✎** Update Entry](cloudcannon:collections/_posts/2019-10-16-release-2-0-23.md)

## Release 1.1.1

October 04, 2019 minor

This release introduces

**Features:**

\* Addition of bypass parameter to Validate Unlocked Package for Metadata Coverage Task \(check bypass option available in sfpowerkit [https://github.com/Accenture/sfpowerkit](https://github.com/Accenture/sfpowerkit) \)

**Fixes:**

\*None

[**✎** Update Entry](cloudcannon:collections/_posts/2019-10-04-release-1-1-1.md)

## 1.0.142

September 28, 2019 minor

This release features the following

**Fixes:**

\* Minor release to fix some documentation and links to pipelines

[**✎** Update Entry](cloudcannon:collections/_posts/2019-09-28-1-0-142.md)

## Release 1.0.137

September 24, 2019 major

This release introduces SFPowerscripts, an open source extension for Azure Pipelines for Salesforce CI/CD

**Features:**

**Common/Utility Tasks**

* Install SFDX CLI along with SFPowerkit Plugin
* Authenticate an Org using JWT or Username/Password/Security Token
* Deployment Related Tasks
* Checkout a source based artifact from Git using PAT
* Deploy a source format based repo to an org \(scratch org/sandbox/prod\)
* Deploy an unlocked package to an org
* Validate a Unlocked package for metadata coverage
* Install all package dependencies of an unlocked package

**Packaging Related Tasks**

* Increment Project Version Number similar to npm version patch, which can be utilized before an unlocked / source based packaging
* Create an unlocked package
* Create a build artifact for unlocked/source based packaging, which can be utilized in Release Pipelines

**Testing Related Tasks**

* Trigger Apex Test
* Validate Apex Test Coverge of an org

**Fixes:**

\* None

[**✎** Update Entry](cloudcannon:collections/_posts/2019-09-24-release-1-0-137.md)

