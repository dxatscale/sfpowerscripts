# Release

The `orchestrator:release` command brings uniformity to the CICD landscape, allowing you to define 'releases' no matter which platform you are on. A release is defined by a YAML file, where you can specify the artifacts to be installed in the org, in addition to other parameters. The release will then be orchestrated based on the configuration of the YAML definition file.   

### Release definition

```text
# release-definition.yaml

release: "release-1.0"
skipIfAlreadyInstalled: true
baselineOrg: "myorg"
artifacts:
  esbasestyleslwc: latest / LATEST_TAG / 1.0.0-1
packageDependencies:
  Marketing Cloud: 04t0H000000xVrw
changelog:
  repoUrl: "https://github.com/myorg/easy-spaces-lwc.git"
  workItemFilter: "BRO-[0-9]{3,4}"
  workItemUrl: "https://www.atlassian.com/software/jira"
  limit: 30
  showAllArtifacts: false

```

| Parameter | Required | Type | Description |
| :--- | :--- | :--- | :--- |
| release | Yes | string | Name of the release |
| skipIfAlreadyInstalled | No | boolean | Skip installation of artifact if it's already installed in target org |
| baselineOrg | No | string | The org used to decide whether or not to skip installation of an artifact.  Defaults to the target org when not provided.  |
| artifacts | Yes | Object | Map of artifacts to deploy and their corresponding version |
| packageDependencies | No | Object | Packages dependencies \(e.g. managed packages\) to install as part of the release. Provide the 04t subscriber package version Id. |
| changelog.repoUrl | No | Prop | The URL of the version control system to push changelog files  |
| changelog.workItemFilter | No | Prop | A regular expression used to identify work items in your commit messages  |
| changelog.workitemUrl | No | Prop | The generic URL of work items, to which to append work item codes. Allows easy redirection to user stories by clicking on the work-item link in the changelog. |
| changelog.limit | No | Prop | Limit the number of releases to display in the changelog markdown |
| changelog.showAllArtifacts | No | Prop | Whether to show artifacts that haven't changed between releases |

### Changelog

When the `--generatechangelog` flag is passed to the command, a changelog will automatically be generated if the release is successful. The changelog provides traceability for the artifacts, work items and commits that were introduced by each release, as well as an at-a-glance view of all your orgs and which release they are currently on.  

{% hint style="info" %}
To generate a changelog, the`changelog.repoUrl` and `changelog.workItemFilter` parameters must be configured in the release definition file.
{% endhint %}

A changelog is generated in markdown format and pushed to the repo, defined in the release definition, under the branch "sfp\_changelog_\_&lt;artifact\_source\_branch&gt;"_.

![Release changelog](../.gitbook/assets/changelog%20%281%29.png)

