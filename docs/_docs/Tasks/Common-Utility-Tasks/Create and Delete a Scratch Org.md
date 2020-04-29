---
title: Create/Delete a Scratch Org
category: Common \ Utility Tasks
order: 3
---

This task is used to create and delete a scratch org and mostly used in a Pull Request validation pipeline. The task is an exact wrapper over the sfdx force:org:create/ sfdx force:org:delete command. The task also features a post execution script which provides  maintenance options such as delete the scratch org after all subsequent tasks are completed,maintain the scratch org for the provided number of days and also a 'do nothing' option, where the management is left to the end user.

To retain scratch org's for review purposes, the maintain org has to be selected and the link to the scratch org along with the expiry timeline will be available in the summary tab as shown below.



**Prerequisites**

Please note [Install SFDX with Sfpowerkit](/Tasks/Common-Utility-Tasks/Install%20SFDX%20CLI/) task is added to the pipeline before utilizing this task


**Task Snapshot**

**![](/images/Create or Delete a scratchorg.png){: width="832" height="519"}**

**Task Version and Details**

id: sfpwowerscript-managescratchorg-task

version: 5.0.2

**Input Variables**

* **Action(action)** Select the action that this task should do, either create or delete an existting scratch org. Possible values are Create and Delete

* **Config File Path(config\_file\_path)**

The path to the file containing the configurations of the scratch org to be created. This field is only visible when Create mode is selected.

* **Alias(alias)**

Provide the alias for the scratch org, that is to be created. This field is visible only when create is activated

* **Alias or username of the target org(alias)**

Provide the alias for the scratch org, that is to be created. This field is visible only when create is activated

* **Alias/username of the DevHub (devhub\_alias)**

Provide the alias of the devhub previously authenticated, default value is HubOrg if using the Authenticate Org task

* **Select an option for deleting this scratch org (maintain)**

The following options are available to be executed post the run of this command. The options are the following

      - "delete": "Delete this org after all subsequent tasks are executed",
      - "maintain": "Maintain this org for x number of days",
      - "donothing": "Do Nothing, Deletion of the scratch org will be handled explicitly"


* **Number of days this scratch org has to be maintained (daystomaintain)**

This option is only visible if the value for maintain is set to "Maintain this org for x number of days (maintain)". Provide the number of days for which the scratch org has to be maintained for reviewing the Pull Request

* **Working directory to be installed(working\_directory)**

The root directory that contains the sfdx-project.json. In build pipelines you can craete this blank, however when used in release pipelines mention the repo directory

* **Send Anonymous Usage Telemetry (isTelemetryEnabled)**

   Enable this flag to send anonymous usage telemetry to track usage and bring further improvements to this task

**Output Variables**

* **sfpowerscripts\_scratch\_org\_url**

The url of the scratch org that was created

* **sfpowerscripts\_scratch\_org\_username**

The username of the scratch org that was created

**Control Options**

**Gotcha's**

Provide the repo path for the working directory in a releaase pipeline

**Changelog**

* 5.0.2 Minor Logging fixes
* 5.0.1 Added option to review the created Scratch Org in Summary Tab, Scratch Org cleanup without using an additional delete task, automatically handled by as a post execution step
* 4.1.1 Updated with Telemetry
* 3.1.0 Updated task with a newer version id
* 2.1.0 Deprecated
* 2.1.0 Initial Version
