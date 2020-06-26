---
title: Install Package Dependencies
category: Common \ Utility Tasks
order: 4
---

This task is a wrapper over sfpowerkit:package:dependencies:install command. This tasks can be used to install any unlocked or managed package dependencies for package. Check more details on the sfpowerkit task [here](https://github.com/accenture/sfpowerkit#sfpowerkitpackagedependenciesinstall){: target="_blank"}
{: .present-before-paste}

**Prerequisites**
{: .present-before-paste}

Please&nbsp; note [Install SFDX with Sfpowerkit&nbsp;](/Tasks/Common-Utility-Tasks/Install%20SFDX%20CLI/) task is added to the pipeline before utilizing this task
{: .present-before-paste}

**Task Snapshot**
{: .present-before-paste}

**![](/images/Install Package Dependencies.png){: width="822" height="501"}**
{: .present-before-paste}

**Task Version and Details**
{: .present-before-paste}

id: sfpowerscript-installpackagedependencies-task
{: .present-before-paste}

version: 4.0.4
{: .present-before-paste}

**Input Variables&nbsp; - Visual Designer Labels (Yaml variables)**
{: .present-before-paste}

* **Alias or username of the target org(target\_org)**
  {: .present-before-paste}

  Provide the alias or username of the target org&nbsp; on which the source directory is to be deployed
  {: .present-before-paste}
* **Alias/Username of the devhub (devhub\_alias)**
  {: .present-before-paste}

  Provide the alias or username of the devhub which houses these unlocked packages
  {: .present-before-paste}
* **Installation Keys”(keys)**
  {: .present-before-paste}

  Installation key for key-protected packages in the dependencies (format is 1:MyPackage1Key 2: 3:MyPackage3Key… to allow some packages without installation key)
  {: .present-before-paste}
* **Compile Apex from only the package (checkonly)&nbsp;**
  {: .present-before-paste}

  For unlocked packages only, specifies whether to compile all Apex in the org and package, or only the Apex in the package.
  {: .present-before-paste}
* **Force Upgrade the package (forceinstall)**
  {: .present-before-paste}

  Update all packages even if they are installed in the target org
  {: .present-before-paste}
* **Project Directory (working\_directory)**
  {: .present-before-paste}

  Leave it blank if the sfdx-project.json is in the root of the repository, else provide the folder directory containing the sfdx-project.json
  {: .present-before-paste}

**Output Variables**
{: .present-before-paste}

None
{: .present-before-paste}

**Control Options**
{: .present-before-paste}

None
{: .present-before-paste}

**Gotcha’s**
{: .present-before-paste}

&nbsp;
{: .present-before-paste}

**Changelog**
{: .present-before-paste}

* 4\.0.4 Remove Telemetry collection
* 3\.0.9 Refactored to use revamped folder structure
* 2\.0.1 Updated with Telemetry
* 1\.8.0 Initial Version