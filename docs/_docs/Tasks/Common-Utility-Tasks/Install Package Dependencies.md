---
title: Install Package Dependencies
category: Common \ Utility Tasks
order: 4
---

This task is a wrapper over sfpowerkit:package:dependencies:install command. It is used to install any unlocked or managed package dependencies for an unlocked package

**Prerequisites**

Please&nbsp; note [Install SFDX with Sfpowerkit&nbsp;](/Tasks/Common-Utility-Tasks/Install%20SFDX%20CLI/) task is added to the pipeline before utilizing this task

**Task Snapshot**

**![](/images/Install Package Dependencies.png){: width="822" height="501"}**

**Task Version and Details**

id: sfpowerscript-installpackagedependencies-task

version: 2.0.1

**Input Variables&nbsp; - Visual Designer Labels (Yaml variables)**

* **Alias or username of the target org(target\_org)**

  Provide the alias or username of the target org&nbsp; on which the source directory is to be deployed

* **Alias/Username of the devhub (devhub\_alias)**

  Provide the alias or username of the devhub which houses these unlocked packages

* **Installation Keys"(keys)**

  Installation key for key-protected packages in the dependencies (format is 1:MyPackage1Key 2: 3:MyPackage3Key… to allow some packages without installation key)

* **Compile Apex from only the package (checkonly)&nbsp;**

  For unlocked packages only, specifies whether to compile all Apex in the org and package, or only the Apex in the package.

* **Force Upgrade the package (forceinstall)**

  Update all packages even if they are installed in the target org

* **Project Directory (working\_directory)**

  Leave it blank if the sfdx-project.json is in the root of the repository, else provide the folder directory containing the sfdx-project.json

* **Send Anonymous Usage Telemetry (isTelemetryEnabled)**

   Enable this flag to send anonymous usage telemetry to track usage and bring further improvements to this task

**Output Variables**

None

**Control Options**

None

**Gotcha's**

&nbsp;

**Changelog**

* 2\.0.1 Updated with Telemetry
* 1\.8.0 Initial Version