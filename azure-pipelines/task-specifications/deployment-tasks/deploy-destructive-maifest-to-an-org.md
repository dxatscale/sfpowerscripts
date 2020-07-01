# Deploy Destructive Maifest to an org

This task is a thin wrapper over sfpowerkit:org:destruct \([link](https://github.com/Accenture/sfpowerkit)\). Typically, destructive manifest are deployed as a seperate pipeline in Org based development model. This task helps one to build a pipeline

**Prerequisites**

Please note [Install SFDX with Sfpowerkit](../utility-tasks/install-sfdx-cli-with-sfpowerkit.md) task is added to the pipeline before utilizing this task

**Task Snapshot**

**Task Version and Details**

id: sfpwowerscript-deploydestructivemanifest-task

version: 3.0.9

**Input Variables  - Visual Designer Labels \(Yaml variables\)**

* **Alias or username of the target org\(target\_org\)**

  Provide the alias or username of the target org  on which destructive manifest has to be udpdated

* **Method \(method\)**

  Choose the mode, if text \(Text\) is selected, please enter a multi line destructive changes in the next field, or alternatively select filePath \(FilePath\) to mention the path to where destructive changes should be deployed.

* **Enter the destructive manifest \(destructive\_manifest\_text\)**

If text is the preferred method, please follow the instructions here \(https://developer.salesforce.com/docs/atlas.en-us.daas.meta/daas/daas\_destructive\_changes.htm \) on how to create the file

* **The path to the destrucive manifest file \(destructive\_manifest\_filepath”\)**

If FilePath is the preferred mode, please provide the path to the file in the checkout code repository associated with the build

* **Send Anonymous Usage Telemetry \(isTelemetryEnabled\)**

  Enable this flag to send anonymous usage telemetry to track usage and bring further improvements to this task

**Output Variables**

None

**Control Options**

None

**Gotcha’s**

None

**Changelog**

* 3.0.9 Refactored to use revamped folder structure
* 2.0.1 Updated with Telemetry
* 1.7.0 Initial Version

