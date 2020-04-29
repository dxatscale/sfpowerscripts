---
title: Promote an Unlocked Package
category: Packaging Tasks
order: 13
---

This task is used to promote an unlocked package to 'released' state before deploying it into a production org. You can read more about promoting a package to released status [here](https://developer.salesforce.com/docs/atlas.en-us.sfdx_dev.meta/sfdx_dev/sfdx_dev_dev2gp_create_pkg_ver_promote.htm). It is recommended to utilize this taks in the 'Prod' stage in a release pipeline in most normal scenarios, where a tested package in the lower environment is ready to be deployed to production and the version number has to be frozen.

**Prerequisites**

Please note [Install SFDX with Sfpowerkit](/Tasks/Common-Utility-Tasks/Install%20SFDX%20CLI/) task is added to the pipeline before utilizing this task


**Task Snapshot**

![](data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVQYV2P4////fwAJ+wP9BUNFygAAAABJRU5ErkJggg==){: .cms-image-placeholder}![](/uploads/promote-an-unlocked-package.png){: width="800" height="457"}

**Task Version and Details**

id: sfpwowerscript-promoteunlocked-task

version: 2.0.1

**Input Variables&nbsp; - Visual Designer Labels (Yaml variables)**

* **Name of the package to be promoted(package)**

  The name of the package that is to be promoted to the released state. This name does not have any signifcant value addition other than being just displayed in the task execution

* **Package to be promoted from(packagepromotedfrom)**

This task has two options, 'BuildArtifact' or using a 'Custom'. If you specify BuildArtifact (when used in a release pipeline with sfpowerscript build artifact),specify the attached build artifact in the Artifact input parameter. If it custom option is selected, pass in the package version id

* **Alias/username of the DevHub (devhub\_alias)**

Provide the alias of the devhub previously authenticated, default value is HubOrg if using the Authenticate Org task

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
* 1.6.0 Initial Version