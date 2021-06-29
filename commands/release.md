# Release

The `orchestrator:release` command brings uniformity to the CICD landscape, allowing you to define 'releases' no matter which platform you are on. A release is defined by a YAML file, where you can specify the artifacts to be installed in the org, in addition to other parameters. The release will then be orchestrated based on the configuration of the YAML definition file.

## Release definition

```text
# release-definition.yaml

release: "release-1.0"
skipIfAlreadyInstalled: true
baselineOrg: "myorg"
promotePackagesBeforeDeploymentToOrg:"SIT"
artifacts:
  mypackageA: alpha # Supports NPM tags
  mypackageB: LATEST_TAG # Substituted with version from latest git tag at runtime
  mypackageC: 1.2.3-5 # Provide the exact version to download
packageDependencies:
  Marketing Cloud: 04t0H000000xVrw
changelog:
  repoUrl: "https://github.com/myorg/myrepo.git"
  workItemFilter: "BRO-[0-9]{3,4}"
  workItemUrl: "https://www.atlassian.com/software/jira"
  limit: 30
  showAllArtifacts: false
```

| Parameter | Required | Type | Description |
| :--- | :--- | :--- | :--- |
| release | Yes | string | Name of the release |
| skipIfAlreadyInstalled | No | boolean | Skip installation of artifact if it's already installed in target org |
| baselineOrg | No | string | The org used to decide whether or not to skip installation of an artifact.  Defaults to the target org when not provided. |
| artifacts | Yes | Object | Map of artifacts to deploy and their corresponding version |
| promotePackagesBeforeDeploymentToOrg | No | string | Promote packages before they are installed into an org that matches alias of the org |
| packageDependencies | No | Object | Packages dependencies \(e.g. managed packages\) to install as part of the release. Provide the 04t subscriber package version Id. |
| changelog.repoUrl | No | Prop | The URL of the version control system to push changelog files |
| changelog.workItemFilter | No | Prop | A regular expression used to identify work items in your commit messages |
| changelog.workitemUrl | No | Prop | The generic URL of work items, to which to append work item codes. Allows easy redirection to user stories by clicking on the work-item link in the changelog. |
| changelog.limit | No | Prop | Limit the number of releases to display in the changelog markdown |
| changelog.showAllArtifacts | No | Prop | Whether to show artifacts that haven't changed between releases |

## Fetching Artifacts for Release

The `orchestrator:release` command provides a simplified method of fetching artifacts from an artifact repository using the release defintion file which contains the name of the artifacts that you want to download, and a mapping to the version to download. If fetching from a **NPM registry**, the command will handle everything else for you. However, for universal artifacts there is no uniform method for downloading artifacts from a repository, so you will need to provide a shell script that calls the relevant API.

{% hint style="info" %}
The `LATEST_TAG` keyword is only supported if the current working directory is pointing to the project directory, and if at least one git tag exists for the package.
{% endhint %}

### Fetching universal artifacts

For universal artifacts, there is no uniform method for downloading artifacts from a registry, so you will need to provide a shell script that calls the relevant API. You need to pass the path to script file using the flag `--scriptpath`

There are multiple parameters available in the shell script. Pass these parameters to the API call, and at runtime they will be substituted with the corresponding values:

1. Artifact name
2. Artifact version
3. Directory to download artifacts 

**Eg.** **Fetching from Azure Artifacts using the Az CLI on Linux**

```text
#!/bin/bash

# $1 - artifact name
# $2 - artifact version
# $3 - artifact directory 

echo "Downloading Artifact $1 Version $2"

az artifacts universal download --feed myfeed --name $1 --version $2 --path $3 \
    --organization "https://dev.azure.com/myorg/" --project myproject --scope project
```

## Changelog

When the `--generatechangelog` flag is passed to the command, a changelog will automatically be generated if the release is successful. The changelog provides traceability for the artifacts, work items and commits that were introduced by each release, as well as an at-a-glance view of all your orgs and which release they are currently on.

{% hint style="info" %}
To generate a changelog, the`changelog.repoUrl` and `changelog.workItemFilter` parameters must be configured in the release definition file.
{% endhint %}

A changelog is generated in markdown format and pushed to the repo, utilizing the `branchname` flag provided to the release command. If the command finds a previous changelog files, it will utilize to generate an incremental changelog

![Release changelog](../.gitbook/assets/changelog%20%281%29.png)

