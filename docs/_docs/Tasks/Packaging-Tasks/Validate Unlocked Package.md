---
title: Validate Unlocked Package for Metadata Coverage
category: Packaging Tasks
order: 9
---

This task is used to validate the metadata coverage of components that are part of the unlocked package you are building. Typically there are components in normal development that are not covered by unlocked packaging such as settings. Having this metadata in your project directory results either these metadata to be skipped or results in an error during the time of packaging. This task checks whether the source directory has any such issues.

**Prerequisites**

Please note [Install SFDX with Sfpowerkit](/Tasks/Common-Utility-Tasks/Install%20SFDX%20CLI/) task is added to the pipeline before utilizing this task

**Task Version and Details**

id: sfpwowerscript-validatedxunlockedpackage-task

version: 3.0.9

**Input Variables&nbsp; - Visual Designer Labels (Yaml variables)**


* **Send Anonymous Usage Telemetry (isTelemetryEnabled)**

   Enable this flag to send anonymous usage telemetry to track usage and bring further improvements to this task


**Output Variables**

**Control Options**

**Gotcha's**

**Changelog**

* 3.0.9 Refactored to use revamped folder structure
* 2.0.1 Updated with Telemetry
* 1.0.0 Updated for inclusion of bypass option from sfpowerkit