---
title: Create a new version of Unlocked Package 
category: Packaging Tasks
order: 10
---

This task is used to create a new version of a  Unlocked Package. You can read more about unlocked packages [here](https://developer.salesforce.com/docs/atlas.en-us.sfdx_dev.meta/sfdx_dev/sfdx_dev_dev2gp.htm)

**Prerequisites**

Please note [Install SFDX with Sfpowerkit](/Tasks/Common-Utility-Tasks/Install%20SFDX%20CLI/) task is added to the pipeline before utilizing this task

**Task Snapshot**

**![](/images/Create a new version of SFDX Package .png){: width="852" height="768"}**

**Task Version and Details**

id: sfpwowerscripts-createunlockedpackage-task

version: 7.0.2

**Input Variables&nbsp; - Visual Designer Labels (Yaml variables)**

* **ID or alias of the package(package)**

  Provide the alias or username of the target org&nbsp; on which the source directory is to be deployed

* **the version number of the package to be created" (version\_number)**

  The format is major.minor.patch.buildnumber . This will override the build number mentioned in the sfdx-project.json, Try considering the use of [Increment Version Number task](/Tasks/Packaging-Tasks/Increment%20Version%20number%20of%20a%20package/)before this task

* **Tag of the package version(tag)**

The Tag of the package version to be created

* **Enable generation of test coverage of this paritcular package(enable\_coverage)**

Calculate and store the code coverage percentage by running the Apex tests included in this package version.

* **Skip Validation of Dependencies,Ancestors etc(isValidationToBeSkipped)**

Enable this flag to skip validation of dependencies,while creating a package. A package created using this flag cannot be promoted to production


* **Config File Path(config\_file\_path)**

  Path in the current project directory containing config file for the packaging org

* **Bypass Installation Key(installationkeybypass)**

  Check this flage, if you have to bypass the requirement for having an installation key for this version of the package

* **Installation Key(installationkey)**

  If the Bypass Installation key is not checked, use this field to provide an installation key

* **Project directory (project\_directory)**

  Leave it blank if the sfdx-project.json is in the root of the repository, else provide the folder directory containing the sfdx-project.json

* **Wait Time (wait\_time)**

  Time to wait for this execution to complete,after this set wait time&nbsp; the next task in the pipeline will be executed. It is recommended to provide sufficient wait time so that the command can be made into a synchronous execution

* **Create a build artifact with the package id if the package creation is successful"(build\_artifact\_enabled)**

  Check this flag to associate this version along with metadata details like package\_version\_id ,sourceVersion and repository\_url as a build artifact associated with this build pipeline, which allows the build pipeline to be associated with a release pipeline

* **Send Anonymous Usage Telemetry (isTelemetryEnabled)**

   Enable this flag to send anonymous usage telemetry to track usage and bring further improvements to this task

**Output Variables**

* **sfpowerscripts\_package\_version\_id**

This variable holds the id of the package version. Use this package version to install it or use it for any other subsequent tasks

**Control Options**

None

**Gotcha's**

Please ensure a package is created manually before utilizing this task, as this task is all about creating a new version of the package

**Changelog**

* 7.0.2 Support for creation of multiple packages in a single build such as in a MonoRepo
* 6.0.1 Skip Validation
* 5.1.2 Hotfix for Exception bug
* 5.0.1 Updated with Telemetry
* 4.0.0 Added Coverage Option
* 3.1.0 Initial Version
