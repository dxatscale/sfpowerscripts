# Generate Artifacts on Build Stage

sfpowerscripts \(cli/azure pipelines\) is built on the concept of generating artifacts for all kinds of package,  creation tasks, irrespective whether its unlocked or not, which then could be versioned, uploaded into an artifact provider or utilized in subsequent stages for deployment orchestration. 

The following package creation commands outlines this concept in action

* Create Source Package
* Create Unlocked Package
* Create Delta Package

These tasks should be invoked on a build stage \( when a feature branch merges into a integration branch\).   We also provide tasks such as Create Source Package \( for projects which do not use an unlocked package\) to produce these artifacts.

![Use of artifacts across different stages](../.gitbook/assets/build-deploy.png)

These commands create an JSON based artifact with format `<package-name>_artifact_metadata` . We plan to extend this schema with more metadata as applicable in the future.

```text
#sample artifact schema for unlocked package produced by Create Unlocked Package

{
  "package_name": "async-framework",
  "package_version_number": "0.1.0.80",
  "package_version_id": "04t1P000000IwtzQAC",
  "sourceVersion": "1815441c8196cadbc68cbf261b57e75165a8cd5d",
  "repository_url": "https://github.com/XXXXXX/yyyyyyyyy",
  "package_type": "unlocked",
  "test_coverage": 0,
  "has_passed_coverage_check": false,
}

```

The above JSON based schema is written to a file and is then treated as the build output a \(In the case of azure pipelines, there are options build artifact\) and could be uploaded to an artifact provider such as Azure Artifact.

The extension also has helper tasks that helps to install packages directly utilizing these artifacts. Check out these tasks to understand how to use these artifacts

{% page-ref page="../azure-pipelines-1/task-specifications/packaging-tasks/create-source-based-package.md" %}

{% page-ref page="../azure-pipelines-1/task-specifications/deployment-tasks/checkout-a-build-artifact.md" %}

{% page-ref page="../azure-pipelines-1/task-specifications/deployment-tasks/deploy-a-source-repo-to-org.md" %}

{% page-ref page="../azure-pipelines-1/task-specifications/deployment-tasks/install-an-unlocked-package-to-an-org.md" %}

