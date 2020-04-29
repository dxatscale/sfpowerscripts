---
title: Deploy a Source Repo to Org
category: Deployment Tasks
subcategory: Deployment Tasks
order: 15
---

This task is used to deploy/validate metadata which is in source format (newer format) to any org, be it a scratch org, sandbox or production. The task does the following things.

1. Converts the source directory to metadata using source:convert command
2. Use mdapi:deploy to deploy/validate the converted metadata to an org
3. Run any associated test runs supported along with the mdapi:deploy command

You can read about mdapi:deploy command [here](https://developer.salesforce.com/docs/atlas.en-us.sfdx_cli_reference.meta/sfdx_cli_reference/cli_reference_force_mdapi.htm) and understand the various options

**Prerequisites**

Please note [Install SFDX with Sfpowerkit](/Tasks/Common-Utility-Tasks/Install%20SFDX%20CLI/) task is added to the pipeline before utilizing this task


**Task Snapshot**

![](/images/Deploy Source To Org.png){: width="951" height="629"}

**Task Version and Details**

id: sfpowerscript-deploysourcetoorg-task

version: 6.0.6

**Input Variables&nbsp; - Visual Designer Labels (Yaml variables)**

* **Alias or username of the target org(target\_org)**

  Provide the alias or username of the target org&nbsp; on which the source directory is to be deployed

* **SFDX Project directory that needs to be deployed (project\_directory)**

  Leave it blank if the sfdx-project.json is in the root of the repository, else provide the folder directory containing the sfdx-project.json

* **Source Directory to be deployed (source\_directory)**

  mention the source directory in your project directory that needs to be deployed

* **Validate Deployment, do not deploy (checkonly)&nbsp;**

  Enable this for doing a validate only. Utilise this mechanism for Pull Request against Sandbox to validate the metadata

   Once enabling this the following action will be enabled, where a file such as .validationignore can be specified that can be used to ignore certain metadata during a validate only deployment.<br>This is needed to overcome certain salesforce quirks, where during a validate only deployment, it raise unwanted errors if your source contains say a metadata such as ApexTestSuite

  * ![](/uploads/deploy-source-to-org-validate-only-deployment.png){: width="800" height="147"}

* **Wait Time (wait\_time)**

  Time to wait for this execution to complete,after this set wait time&nbsp; the next task in the pipeline will be executed. It is recommended to provide sufficient wait time so that the command can be made into a synchronous execution

* **Test Level (testlevel)**

  Select the appropriate test level if test are required to be exectued along with the deployment, Possible values are the following
  * "NoTestRun":  Do not run any tests 
  * "RunSpecifiedTests": Run specified tests mentioned in the following configuration item "Tests to be Executed(specifed_tests)
  * "RunApexTestSuite": Run an apex test suite (apextextsuite)
  * "RunLocalTests": Run all the local tests
  * "RunAllTestsInOrg": Run all the tests in the org

* **Tests to be executed (specifed_tests)**
  
  Only visible, if the testlevel is RunSpecifiedTests, Provide a comma seperated values of all the  test classes that need to be executed
 
 * **ApexTextSuite (apextextsuite)**
  
  Only visible, if the testlevel is RunApexTestSuite, Provide the name of the apex test suite that need to be executed

* **Break Build if the provided metadata folder is empty(isToBreakBuildIfEmpty)** *
 
   Enable this flag to break the build, if the metadata folder provide is empty, other wise the task will ignore and just move to the next task if encountering an empty metadata folder

* **Send Anonymous Usage Telemetry (isTelemetryEnabled)**

   Enable this flag to send anonymous usage telemetry to track usage and bring further improvements to this task

**Output Variables**

* **sfpowerkit\_deploysource\_id**

This variable holds the id of the deployment, you can use the deployment id to pull reports or do any further action on subsequent tasks

**Control Options**

None

**Gotcha's**

&nbsp;

**Changelog**

* 6.0.6 Support for installation of packages of a build that generate multiple artifacts such as MonoRepo and Bugfixes
* 5.1.0 Break Build if empty metadata is encountered
* 3.0.1 Updated with Telemetry
* 2.8.0 Initial Version