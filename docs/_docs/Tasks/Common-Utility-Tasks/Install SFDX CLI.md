---
title: Install SFDX CLI with SFPowerkit
category: Common \ Utility Tasks
order: 1
---

This task is usually the first task of any pipeline you build using sfpowerscripts. It installs the SFDX CLI along with the open source extension '[sfpowerkit](https://github.com/Accenture/sfpowerkit)'.&nbsp;

Please note this task is not supported in Hosted Mac Agents as of now

**Task Snapshot**

![](/images/Install SFDX CLI Task.PNG){: width="930" height="374"}

**Task Version and Details**

id: sfpwowerscript-installsfdx-task

version: 5.0.3

**Input Variables \[Visual Designer Labels / Yaml variables\]**


* **Override Default Salesforce API Version used by the CLI and Plugins (salesforce\_api\_version)**

  Provide an API version which the CLI commands should utilize, if ignored, the latest GA version used by the sfdx cli is used

* **SFDX CLI Version (sfdx\_cli\_version)**

  By default, the latest SFDX CLI version will be installed. You can override this by providing the version number found in [Salesforce CLI Release Notes](https://developer.salesforce.com/media/salesforce-cli/releasenotes.html)

* **SFPowerkit Version (sfpowerkit\_version)**

  By default, the latest SFPowerkit version will be installed. You can override this by providing the version number found in [SFPowerkit Release Notes](https://github.com/Accenture/sfpowerkit/releases)

* **Additional Plugins to be installed &nbsp;(plugins)**<br><br>Provide additional sfdx plugins to be installed, when this task is run. The format to be followed is&nbsp;**pluginame1@version,pluginname2@version&nbsp;**and so forth.

* **Send Anonymous Usage Telemetry (&nbsp;****isTelemetryEnabled )**<br><br>Enable this flag to send anonymous usage telemetry to track usage and bring further improvements to this task.

**Output Variables**

None

**Control Options**

None

**Gotcha's**

**Changelog**

* 5.0.3 Minor formatting fixes
* 5.0.0 Add support for overriding api version to be used in commands
* 4.0.5 Introduce support to work on Hosted Windows Agents and also support installation of additional plugins
* 3.2.1 Updated with Telemetry
* 2.0.0 Task updated with new id
* 1.3.0 Deprecated the task&nbsp;
* 1.2.0 Initial Version