# Create/Delete a Scratch Org

| Task Id | Version |
| :--- | :--- |
| sfpwowerscript-managescratchorg-task | 8.0.15 |

This task is used to create and delete a scratch org and mostly used in a Pull Request validation pipeline. The task is an exact wrapper over the sfdx force:org:create/ sfdx force:org:delete command. The task also features a post execution script which provides maintenance options such as delete the scratch org after all subsequent tasks are completed, maintain the scratch org for the provided number of days and also a ‘do nothing’ option, where the management is left to the end user.

To retain scratch org’s for review purposes, the maintain org has to be selected and the link to the scratch org along with the expiry timeline will be available in the summary tab as shown below.

**Prerequisites**

[Install SFDX with Sfpowerkit](install-sfdx-cli-with-sfpowerkit.md) task must be added to the pipeline before utilizing this task

**Task Snapshot**

**Parameters**

{% tabs %}
{% tab title="Input Paramters" %}
Classic Designer Labels are in **Bold,** YAML Variables are in _italics_

* **Action /** _action_  Select the action that this task should do, either create or delete an existing scratch or delete an existing scratch org. The options 

```text
"create": create a scratch org
"delete": delete an existing scratch org
```

* **Config File Path** / _action_ The path to the file containing the configurations of the scratch org to be created. This field is only visible when Create mode is selected. 
* **Alias /** _alias_ Provide the alias for the scratch org, that is to be created. This field is visible only when create is activated 
* **Alias or username of the target org /** _alias_

  Provide the alias for the scratch org, that is to be created. This field is visible only when create is activated

* **Alias/username of the DevHub /** _devhub\_alias_

  Provide the alias of the devhub previously authenticated.

* **Select an option for deleting this scratch org /** _maintain_

  The following options are available to be executed post the run of this command. The options are the following

```text
  "delete": "Delete this org after all subsequent tasks are executed",
  "maintain": "Maintain this org for x number of days",
  "donothing": "Do Nothing, Deletion of the scratch org will be handled explicitly"
```

* **Number of days this scratch org has to be maintained /** _daystomaintain_ _\*\*_This option is only activated if the value for maintain is set to “Maintain this org for x number of days \(maintain\)”. Provide the number of days for which the scratch org has to be maintained for reviewing the Pull Request 
* **Project Directory /** _working\_directory_ The root directory that contains the sfdx-project.json. In build pipelines you can create this blank, however when used in release pipelines mention the repo directory 
{% endtab %}

{% tab title="Output Parameters" %}
* **sfpowerscripts\_scratch\_org\_url** The url of the scratch org that was created
* **sfpowerscripts\_scratch\_org\_username** The username of the scratch org that was created

Please note to add a reference name before using this in any of the tasks
{% endtab %}

{% tab title="YAML Example" %}
```text
- task: sfpwowerscript-managescratchorg-task@5
            displayName: Create Scratch Org
            inputs:
             action: 'Create'
             config_file_path: 'config/project-scratch-def.json'
             alias: 'scratchorg'
             devhub_alias: 'HubOrg'
             maintainorg: 'delete'
             isTelemetryEnabled: true
```
{% endtab %}
{% endtabs %}

{% hint style="warning" %}
If for some reason, you are using this task in a release pipeline, Project Directory has to be mentioned and has to match the directory \(the artifact\) is checked out to. You can read more about release artifacts here [https://docs.microsoft.com/en-us/azure/devops/pipelines/release/artifacts?view=azure-devops](https://docs.microsoft.com/en-us/azure/devops/pipelines/release/artifacts?view=azure-devops)
{% endhint %}

**Changelog**

* 8.0.9 Bugfix [\#93](https://github.com/Accenture/sfpowerscripts/issues/93) scratch org username output variable
* 8.0.5
  * Removed Telemetry collection 
  * Fix [\#63](https://github.com/Accenture/sfpowerscripts/issues/63) Manage ScratchOrg Task fails when it is used for delete action
* 7.0.4 Refactored to use revamped folder structure
* 5.0.2 Minor Logging fixes
* 5.0.1 Added option to review the created Scratch Org in Summary Tab, Scratch Org cleanup without using an additional delete task, automatically handled by as a post execution step
* 4.1.1 Updated with Telemetry
* 3.1.0 Updated task with a newer version id
* 2.1.0 Deprecated
* 2.1.0 Initial Version

