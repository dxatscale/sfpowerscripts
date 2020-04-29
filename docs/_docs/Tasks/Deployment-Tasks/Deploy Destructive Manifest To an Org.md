---
title: Deploy Destructive Maifest to an org
category: Deployment Tasks
subcategory: Deployment Tasks
order: 16
---

This task is a thin wrapper over sfpowerkit:org:destruct ([link](https://github.com/Accenture/sfpowerkit)). Typically, destructive manifest are deployed as a seperate pipeline in Org based development model. This task helps one to build a pipeline

**Prerequisites**

Please note [Install SFDX with Sfpowerkit](/Tasks/Common-Utility-Tasks/Install%20SFDX%20CLI/) task is added to the pipeline before utilizing this task


**Task Snapshot**

![](/uploads/deploy-destructive-manifest-to-org.PNG){: width="800" height="400"}

**Task Version and Details**

id: sfpwowerscript-deploydestructivemanifest-task

version: 2.0.1

**Input Variables&nbsp; - Visual Designer Labels (Yaml variables)**

* **Alias or username of the target org(target_org)**

  Provide the alias or username of the target org&nbsp; on which destructive manifest has to be udpdated

* **Method (method)**

  Choose the mode, if text (Text) is selected, please enter a multi line destructive changes in the next field, or alternatively select filePath (FilePath) to mention the path to where destructive changes should be deployed.
 
* **Enter the destructive manifest (destructive_manifest_text)**

If text is the preferred  method, please follow the instructions here (https://developer.salesforce.com/docs/atlas.en-us.daas.meta/daas/daas_destructive_changes.htm ) on how to create the file

* **The path to the destrucive manifest file (destructive_manifest_filepath")**

 If FilePath is the preferred mode, please provide the path to the file in the checkout code repository associated with the build

* **Send Anonymous Usage Telemetry (isTelemetryEnabled)**

   Enable this flag to send anonymous usage telemetry to track usage and bring further improvements to this task


**Output Variables**

None

**Control Options**

None

**Gotcha's**

None

**Changelog**

* 2.0.1 Updated with Telemetry
* 1.7.0 Initial Version