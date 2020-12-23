# Create a Delta Package

| Task ID | Latest Version |
| :--- | :--- |
| sfpwowerscripts-createdeltapackage-task | 6.0.6 |

This task is used to build a changeset \(Delta/Diff between two git commits\) based artifact based on the changes between two commits, which can then be associated with a release pipeline. It is only recommended you utilise a changeset based build process when working on an existing org in the process of refactoring, to eventually utilize modular \(source based/unlocked packaging\) repositories.

This task utilizes the sfpowerkit:project:diff. In case you face any issues with the diff not being accurate, please raise an issue in the [sfpowerkit](https://github.com/Accenture/sfpowerkit) github repository.

**Prerequisites**

[Install SFDX with Sfpowerkit](../utility-tasks/install-sfdx-cli-with-sfpowerkit.md) task must be added to the pipeline before utilizing this task

**Task Snapshot**

![](../../../.gitbook/assets/createdeltapackagesnapshot.png)

## Parameters

{% tabs %}
{% tab title="Input" %}
Classic Designer Labels are in **Bold,** YAML Variables are in _italics_

* **Name of the package /** _package_

  Provide a name of the package

* **The name of the version that needs to be associated with the diff package /** _version\_name_

  Provide a version name to identify this particular delta/diff when used in the release pipeline.

* **Revision ID \(Git Commit ID\) from where the diff should baselined on /** _revision\_from_

  Provide the full SHA Commit ID, from where the diff should be generated from

* **Revision ID \(Git Commit ID\) from where the diff should baselined upto /** _revision\_to_

  Provide the full SHA Commit ID, from where the diff should baselined upto

* **Generate Destructive Manifest based on the diff /** _generate\_destructivemanifest_

  Check this option to generate a destructive manifest, based on the delta/diff between the provided commits

* **SFDX Project directory that needs to be deployed /** _project\_directory_

  Leave it blank if the sfdx-project.json is in the root of the repository, else provide the folder directory containing the sfdx-project.json

* **Set the pipeline’s build number to the the version name mentioned in the task /** _set\_build\_name_

  Check this option if the build number of the pipeline has to match the version name provided in the field version\_name

* **Create a build artifact with the package id if the delta package creation is successful /** _build\_artifact\_enabled_

  Create a build artifact, so that this pipeline can be consumed by a release pipeline

* **Bypass directories\*\* /** _bypass\_directories_

  Exclude a comma-separated list of directories from the generated diff.

* **Generate diff only for the directories mentioned\*\* /** _only\_diff\_for_

  Define a comma-separated whitelist of directories to be included in the generated diff. Creates a sfdx-project.json to support deployment.

* **API version to be used if sfdx-project.json is generated\*\*** / _apiversion_

  Define the API version if a `sfdx-project.json` was generated as part of the the 'Generate diff only for the directories mentioned' parameter.

\*\* Experimental commands
{% endtab %}

{% tab title="Output" %}
**sfpowerscripts\_delta\_package\_path**

The path to the directory where the delta package is created.
{% endtab %}

{% tab title="YAML" %}
```text
steps:
- task: sfpwowerscripts-createdeltapackage-task@5
  displayName: 'Create Delta Package based on two commits'
  inputs:
    package: <mypackage>
    project_directory: [dir]
    revision_from: '$(LATEST_STABLE_TAG)'
    revision_to: '$(Build.SourceVersion)'
```
{% endtab %}
{% endtabs %}

**Changelog**

* 6.0.6 Refactor artifact structure [\#131](https://github.com/Accenture/sfpowerscripts/pull/131)
* 5.0.9 Update Core dependency
* 5.0.4 Remove Telemetry Collection
* 4.0.9 Refactored to use revamped folder structure
* 3.0.0 Support for this task in release pipelines
* 2.0.5 Support for creation of multiple packages in a single build such as in a MonoRepo
* 1.0.0 Initial Version

