---
title: Export Metadata from an org
category: Common \ Utility Tasks
order: 5
---

This task is used to export the complete metadata (in source format) from a given org. This task is helpful for daily backups or further analysis of metadata
{: .present-before-paste}

**Task Snapshot**
{: .present-before-paste}

![](/images/Export a Salesforce Org.PNG){: width="930" height="374"}
{: .present-before-paste}

**Task Version and Details**
{: .present-before-paste}

id: sfpowerscript-exportsourcefromorg-task
{: .present-before-paste}

version: 3.0.4
{: .present-before-paste}

**Input Variables \[Visual Designer Labels / Yaml variables\]**
{: .present-before-paste}

* **Alias or username of the target org(target\_org)**
  {: .present-before-paste}

  Provide the alias or username of the target org&nbsp; on which the source directory is to be deployed
  {: .present-before-paste}
* **Directory to which the source should be exported to(target\_org)**
  {: .present-before-paste}

The path to the directory, where the metadata from the org should be exported to. The path will be created if it doesnt exist. The export from the org is in a zip format, Check the ‘Unzip the exported metadata/source from the zip into the provided folder’
{: .present-before-paste}

* **Metadata that need to be excluded while exporing from the org(target\_org)**

Mention the metadata types seperated by comma, that need to be excluded while exporting. Useful to exclude types such as Connected App, Named Credential etc.
{: .present-before-paste}

* **Exclude managed package components(target\_org)**

Check this option to exclude managed package metadata components to be exported from the target org
{: .present-before-paste}

* **Unzip the exported metadata/source from the zip into the provided folder(target\_org)**
  {: .present-before-paste}

  The exported metadata is in a zip format. Check this option to unzip the zipped extract from the org to the provided directory.
  {: .present-before-paste}

**Output Variables**
{: .present-before-paste}

* sfpowerscripts\_exportedsource\_zip\_path

**Control Options**
{: .present-before-paste}

None
{: .present-before-paste}

**Gotcha’s**
{: .present-before-paste}

**Changelog**
{: .present-before-paste}

* 3\.0.4 Remove Telemetry collection
* 2\.0.9 Refactored to use revamped folder structure
* 1\.0.2 Initial Version