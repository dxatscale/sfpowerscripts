# Promote an Unlocked Package

| Task ID | Latest Version |
| :--- | :--- |
| sfpwowerscript-promoteunlocked-task | 8.0.5 |

This task is used to promote an unlocked package to ‘released’ state before deploying it into a production org. You can read more about promoting a package to released status [here](https://developer.salesforce.com/docs/atlas.en-us.sfdx_dev.meta/sfdx_dev/sfdx_dev_dev2gp_create_pkg_ver_promote.htm). It is recommended to utilize this taks in the ‘Prod’ stage in a release pipeline in most normal scenarios, where a tested package in the lower environment is ready to be deployed to production and the version number has to be frozen.

**Prerequisites**

[Install SFDX with Sfpowerkit](../utility-tasks/install-sfdx-cli-with-sfpowerkit.md) task must be added to the pipeline before utilizing this task.

**Task Snapshot**

![](../../../.gitbook/assets/promoteunlockedpackage.png)

## Parameters

{% tabs %}
{% tab title="Input" %}
* **Name of the package to be promoted /** _package_

  The name of the package that is to be promoted to the released state. This name does not have any significant value addition other than being just displayed in the task execution.

* **Path to the directory where artifacts are downloaded** / _artifactDir_

  Path to the artifact directory where the artifacts are downloaded, If not provided, the default values will be automatically used

* **Project directory** / _project\_directory_

  The directory containing the `sfdx-project.json.`

* **Alias/username of the DevHub /** _devhub\_alias_

  Provide the alias of the Dev Hub previously authenticated, default value is `HubOrg` if using the [Authenticate Org task](../authentication/).

* **Skip if no artifact is found /** _skip\_on\_missing\_artifact_

  Enable this option to remove attached artifacts for a specific release, without having to remove the corresponding task from the release pipeline.
{% endtab %}

{% tab title="Output" %}
None
{% endtab %}

{% tab title="YAML" %}
```text
steps:
- task: sfpwowerscript-promoteunlockedpackage-task@7
  displayName: 'Promote version of package <mypackage> '
  inputs:
    package: <mypackage>
    artifact: '_mypackage'
    project_directory: '$(sfpowerscripts_checked_out_path)'
    skip_on_missing_artifact: false
```
{% endtab %}
{% endtabs %}

{% hint style="warning" %}
Please note for this task to succeeded, the task needs access to the project directory. If you are using this task in the release pipeline, ensure the project directory is available.
{% endhint %}

**Changelog**

* 8.0.5 Remove "packagepromotedfrom" input parameter [\#151](https://github.com/Accenture/sfpowerscripts/pull/151/files)
* 7.0.4 Update Core dependency
* 7.0.0 
  * Removed Telemetry Collection
  * Add support for Azure Artifacts
* 4.0.1 Fix for \#18 Promote task failing to promote unlocked package
* 3.0.9 Refactored to use revamped folder structure
* 2.0.1 Updated with Telemetry
* 1.6.0 Initial Version

