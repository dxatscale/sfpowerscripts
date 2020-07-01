# Create a Delta Package

This task is used to build a changeset \(Delta/Diff between two git commits\) based artifact based on the changes between two commits, which can then be associated with a release pipeline.It is only recommended you utilise a changeset based build process when working on an existing org in the process of refactoring, to eventually utilize modular \(source based/unlocked packaging\) repositories.

This task utilizes the sfpowerkit:project:diff. In case you face any issues with the diff not being accurate, please raise an issue in the sfpowerkit github repository.

**Task Snapshot**

**Task Version and Details**

id: sfpwowerscripts-createdeltapackage-task

version: 4.0.9

**Input Variables  - Visual Designer Labels \(Yaml variables\)**

* **Name of the package\(package\)**

  Provide a name of the package

* **The name of the version that needs to be associated with the diff package \(version\_name\)**

  Provide a version name to identify this particular delta/diff when used in the release pipeline.

* **Revision ID \(Git Commit ID\) from where the diff should baselined on\(revision\_from\)**

  Provide the full SHA Commit ID, from where the diff should be generated from

* **Revision ID \(Git Commit ID\) from where the diff should baselined upto\(revision\_to\)**

  Provide the full SHA Commit ID, from where the diff should baselined upto

* **Generate Destructive Manifest based on the dif\(generate\_destructivemanifest\)**

  Check this option to generate a destructive manifest, based on the delta/diff between the provided commits

* **SFDX Project directory that needs to be deployed \(project\_directory\)**

  Leave it blank if the sfdx-project.json is in the root of the repository, else provide the folder directory containing the sfdx-project.json

* **Set the pipeline’s build number to the the version name mentioned in the task\(set\_build\_name\)**

  Check this option if the build number of the pipeline has to match the Version Name\(version\_name\)

* **Create a build artifact with the package id if the delta package creation is successful\(build\_artifact\_enabled\)**

  Create a build artifact, so that this pipeline can be consumed by a release pipeline

* **Send Anonymous Usage Telemetry \(isTelemetryEnabled\)**

  Enable this flag to send anonymous usage telemetry to track usage and bring further improvements to this task

**Output Variables**

* **sfpowerscripts\_delta\_package\_path**

The path to the directory where the delta package is created

**Control Options**

None

**Gotcha’s**

**Changelog**

* 4.0.9 Refactored to use revamped folder structure
* 3.0.0 Support for this task in release pipelines
* 2.0.5 Support for creation of multiple packages in a single build such as in a MonoRepo
* 1.0.0 Initial Version

