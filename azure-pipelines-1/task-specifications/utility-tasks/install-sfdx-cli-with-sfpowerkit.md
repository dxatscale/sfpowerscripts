# Install SFDX CLI with SFPowerkit

This task is usually the first task of any pipeline you build using sfpowerscripts. It installs the SFDX CLI along with the open source extension ‘sfpowerkit’.

Please note this task is not supported in Hosted Mac Agents as of now

**Task Snapshot**

**Task Version and Details**

id: sfpwowerscript-installsfdx-task

version: 6.0.5

**Input Variables \[Visual Designer Labels / Yaml variables\]**

* **Override Default Salesforce API Version used by the CLI and Plugins \(salesforce\_api\_version\)**

  Provide an API version which the CLI commands should utilize, if ignored, the latest GA version used by the sfdx cli is used

* **SFDX CLI Version \(sfdx\_cli\_version\)**

  By default, the latest SFDX CLI version will be installed. You can override this by providing the version number found in [Salesforce CLI Release Notes](https://developer.salesforce.com/media/salesforce-cli/releasenotes.html)

* **SFPowerkit Version \(sfpowerkit\_version\)**

  By default, the latest SFPowerkit version will be installed. You can override this by providing the version number found in [SFPowerkit Release Notes](https://github.com/Accenture/sfpowerkit/releases)

* **Additional Plugins to be installed  \(plugins\)**

  Provide additional sfdx plugins to be installed, when this task is run. The format to be followed is **pluginame1@version,pluginname2@version** and so forth.

* **Send Anonymous Usage Telemetry \( isTelemetryEnabled \)**

  Enable this flag to send anonymous usage telemetry to track usage and bring further improvements to this task.

**Output Variables**

None

**Control Options**

None

**Gotcha’s**

**Changelog**

* 6.0.5 Refactored to use revamped folder structure
* 5.0.3 Minor formatting fixes
* 5.0.0 Add support for overriding api version to be used in commands
* 4.0.5 Introduce support to work on Hosted Windows Agents and also support installation of additional plugins
* 3.2.1 Updated with Telemetry
* 2.0.0 Task updated with new id
* 1.3.0 Deprecated the task 
* 1.2.0 Initial Version

