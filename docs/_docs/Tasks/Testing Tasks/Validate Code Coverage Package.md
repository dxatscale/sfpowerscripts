---
title: Validate Code Coverage of a Package
category: Testing \ Code Quality Tasks
order: 8
---

This task is used to validate the code coverage of a second generation package.

**Prerequisites**

Please note [Install SFDX with Sfpowerkit](/Tasks/Common-Utility-Tasks/Install%20SFDX%20CLI/) task is added to the pipeline before utilizing this task

**Task Snapshot**

**![](/images/ValidateCodeCoveragePackage.PNG){: width="957" height="522"}**

&nbsp;

**Task Version and Details**

id: sfpwowerscript-validatetestcoveragepackage-task

version: 1.0.0

**\*Input Variables&nbsp; - Visual Designer Labels (Yaml variables)**

* **Alias or username of the devhub(target\_org)**

Provide the alias or username of the target org&nbsp; on which the package version is created

* **Code coverage % to be validated(test\_coverage)**

The percentage of code coverage, that should be validated

* **Package Version Id (package\_version\_id)**

The version of the package which should be validated for code coverage, If you are using this task after Create Unlocked Package, please utilize the output variable to reference the package version id

**Output Variables**

None

**Control Options**

None

**Gotcha's**

None

**Changelog**

* 2.0.1 Updated with telemetry
* 1.0.0 Initial Version