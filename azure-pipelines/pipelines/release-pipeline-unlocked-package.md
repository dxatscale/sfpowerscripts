# Release Pipeline - Unlocked Package

Release pipelines are one of the most exciting benefits of using Azure Pipelines, which is not just for Continous Integration but can also act us an automated release orchestrator. This sample pipeline demonstrates how to orchestrate an installation of an unlocked package across various environments.

[This pipeline](https://raw.githubusercontent.com/azlamsalam/sfpowerscripts/release/SamplePipelines/sfpowerscripts-sample-pipelines/ReleaseDefinitions/Unlocked%20Packaged%20Deployment%20Pipeline%20using%20sfpowerscripts.json) is manually triggered by some one releasing a previously build artifact to the the environment. This could be automated using the various mechanisms available in Azure Pipelines

**Pipeline Snapshot**

You can import and modify this pipeline using the file provide in the [link](https://raw.githubusercontent.com/azlamsalam/sfpowerscripts/release/SamplePipelines/sfpowerscripts-sample-pipelines/ReleaseDefinitions/Unlocked%20Packaged%20Deployment%20Pipeline%20using%20sfpowerscripts.json)

**Tasks Snapshot in one of the stages**

The steps that are part of the pipeline in an individual stage are

1. [Install SFDX CLI](../task-specifications/utility-tasks/install-sfdx-cli-with-sfpowerkit.md)
2. [Authenticate an Org](../task-specifications/authentication/authenticate-an-org.md)\( In this case, it is authenticating against DevHub\)
3. [Authenticate an Org](../task-specifications/authentication/authenticate-an-org.md)\( In this case, it is authenticating against the Sandbox to be deployed\)
4. [Install a version of the unlocked package to the target environment](../task-specifications/deployment-tasks/install-an-unlocked-package-to-an-org.md)

It is recommended to have a variable group created per environment,such as in the figure and associate it with each stage of the pipeline

