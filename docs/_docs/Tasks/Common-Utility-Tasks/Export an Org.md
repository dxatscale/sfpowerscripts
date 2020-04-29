---
title: Export Metadata from an org
category: Common \ Utility Tasks
order: 5
---
This task is used to export the complete metadata (in source format) from a given org. This task is helpful for daily backups or further analysis of metatadata

**Task Snapshot**

![](/images/Export a Salesforce Org.PNG){: width="930" height="374"}

**Task Version and Details**

id: sfpowerscript-exportsourcefromorg-task

version: 1.0.2

**Input Variables \[Visual Designer Labels / Yaml variables\]**


* **Alias or username of the target org(target\_org)**

  Provide the alias or username of the target org&nbsp; on which the source directory is to be deployed


* **Directory to which the source should be exported to(target\_org)**

 The path to the directory, where the metadata from the org should be exported to. The path will be created if it doesnt exist. The export from the org is in a zip format, Check the 'Unzip the exported metadata/source from the zip into the provided folder'
 
* **Metadata that need to be excluded while exporing from the org(target\_org)**

 Mention the metadata types seperated by comma, that need to be excluded while exporting. Useful to exclude types such as Connected App, Named Credential etc.

* **Exclude managed package components(target\_org)**

 Check this option to exclude managed package metadata components to be exported from the target org

* **Unzip the exported metadata/source from the zip into the provided folder(target\_org)**
 
  The exported metadata is in a zip format. Check this option to unzip  the zipped extract from the org to the provided directory.

* **Send Anonymous Usage Telemetry (isTelemetryEnabled )**

Enable this flag to send anonymous usage telemetry to track usage and bring further improvements to this task.

**Output Variables**

* sfpowerscripts_exportedsource_zip_path

**Control Options**

None

**Gotcha's**

**Changelog**

* 1.0.2 Initial Version