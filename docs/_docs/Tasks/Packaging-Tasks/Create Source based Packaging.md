---
title: Create Source based Package 
category: Packaging Tasks
order: 11
---

This task is used to create a build artifact for a source based repo (org deployment), which can then be associated with a release pipeline.



**Task Snapshot**

**![](/images/Create a new version of Source Package .png){: width="839" height="444"}**

**Task Version and Details**

id: sfpwowerscripts-createsourcepackage-task

version: 6.0.0

**Input Variables&nbsp; - Visual Designer Labels (Yaml variables)**

* **Name of the package(package)**

  Provide a name of the package

* **the version number of the package to be created" (version\_number)**

  The format is major.minor.patch.buildnumber . This will override the build number mentioned in the sfdx-project.json, Try considering the use of [Increment Version Number task](/Tasks/Packaging-Tasks/Increment%20Version%20number%20of%20a%20package/) before this task

* **SFDX Project directory that needs to be deployed (project\_directory)**

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

* 6.0.0 Support for creation of multiple packages in a single build such as in a MonoRepo
* 5.1.0 Minor changes in artifact that is getting stored
* 5.0.1 Updated with Telemetry
* 4.0.0 Initial Version