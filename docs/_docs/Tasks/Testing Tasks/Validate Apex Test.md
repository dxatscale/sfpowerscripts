---
title: Validate Code  Coverage of an Org
category:
order: 7
---

This task is used to validate the apex test coverage of an org

**Prerequisites**

Please note [Install SFDX with Sfpowerkit](/Tasks/Common-Utility-Tasks/Install%20SFDX%20CLI/) task is added to the pipeline before utilizing this task

Task Snapshot

![](/uploads/validatecodecoverageorg.PNG){: width="800" height="364"}

**Task Version and Details**

id: sfpwowerscript-validateapextestcoverage-task

version: 4.0.4

**Input Variables**\*

* **Alias or username of the target org(target\_org)**<br><br>Provide the alias or username of the target org&nbsp; on which the unlocked package is to be deployed
* **Tests coverage % to be validated&nbsp; (test\_coverage)**<br><br>The percentage of test coverage for apex clasess, that should be as per the last test run status

**Output Variables**

**Control Options**

**Gotcha’s**

**Changelog**

* 4\.0.4&nbsp; Removed Telemetry Collection