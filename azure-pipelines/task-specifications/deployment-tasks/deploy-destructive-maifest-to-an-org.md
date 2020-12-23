---
description: Deployment Tasks
---

# Deploy Destructive Maifest to an org

| Task Id | Version |
| :--- | :--- |
| sfpwowerscript-deploydestructivemanifest-task | 5.0.11 |

This task is a wrapper over sfpowerkit:org:destruct \([link](https://github.com/Accenture/sfpowerkit)\). This is a helper task to delete metadata from an org using path to a destructive changeset \(destructiveChanges.xml\) or by mentioning the contents in a multiline text field.

> This task is typically used in standalone release pipeline to orchestrate deletion of metadata across multiple sandboxes or used along with [Create a Delta Package task](../packaging-tasks/create-a-delta-package.md) which produces the destructive changes

**Prerequisites**

[Install SFDX CLI with sfpowerkit](../utility-tasks/install-sfdx-cli-with-sfpowerkit.md) task must be added to the pipeline before utilizing this task

**Task Snapshot**

![Task Snapshot of deploying a destructive manifest using the Classic UI](../../../.gitbook/assets/deploy-destructive-manifest-to-org.png)

## Parameters

{% tabs %}
{% tab title="Input Parameters" %}
Classic Designer Labels are in **Bold,** YAML Variables are in _italics_

* **Alias or username of the target org /** _target\_org_

  Provide the alias or username of the target org on which the source directory is to be deployed

* **Destructive Manifest Type** / type Possible values include - **Text /** text - For Inline entry of destructive changes - **Filepath /** filepath - Path to destructiveChanges.xml file
* **Enter the destructive manifes**t /  destructive\_manifest\_text This option is enabled if the type selected is text, Enter the contents that need to be destric 
* **The path to the destructive manifest xml** / destructive\_manifest\_path This option is enabled if the type selected is filepath, Provide an absolute filepath to the destructiveChanges.xml  
* **Skip if unable to find destructive manifest file** / skip\_on\_missing\_manifest Enable this option if you are using this task along with an automatic generation of destructive manifest file \( such as [Create a Delta Package](../packaging-tasks/create-a-delta-package.md) \) and do no want the task to fail if there is no destructive manifest generated in the task above.
{% endtab %}

{% tab title="Output Variables" %}

{% endtab %}

{% tab title="YAML Examples" %}
```text
- task: sfpwowerscript-deploydestructivemanifest-task@<version>
  displayName: 'Deploy destructive manifest to scratchorg'
  inputs:
    method: FilePath
    destructive_manifest_filepath: destructiveChanges.xml
    skip_on_missing_manifest: true
```
{% endtab %}
{% endtabs %}

**Changelog**

* 5.0.4 Update Core dependency
* 5.0.0  - Removed Telemetry  Collection - Added option to skip the task on missing destructive manifest file \([\#15](https://github.com/Accenture/sfpowerscripts/issues/15)\)
* 3.0.9 Refactored to use revamped folder structure
* 2.0.1 Updated with Telemetry
* 1.7.0 Initial Version

