---
title: Release Pipeline - Unlocked Package
category: Pipelines
order: 5
---

Release pipelines are one of the most exciting benefits of using Azure Pipelines, which is not just for Continous Integration but can also act us an automated release orchestrator. This sample pipeline demonstrates how to orchestrate an installation of an unlocked package across various environments.

[This pipeline](https://raw.githubusercontent.com/azlamsalam/sfpowerscripts/release/SamplePipelines/sfpowerscripts-sample-pipelines/ReleaseDefinitions/Unlocked%20Packaged%20Deployment%20Pipeline%20using%20sfpowerscripts.json) is manually triggered by some one releasing a previously build artifact to the the environment. This could be automated using the various mechanisms available in Azure Pipelines

**Pipeline Snapshot**

**![](/images/Unlocked Packages CD Pipeline.PNG){: width="1305" height="455"}**

&nbsp;

You can import and modify this pipeline using the file provide in the [link](https://raw.githubusercontent.com/azlamsalam/sfpowerscripts/release/SamplePipelines/sfpowerscripts-sample-pipelines/ReleaseDefinitions/Unlocked%20Packaged%20Deployment%20Pipeline%20using%20sfpowerscripts.json)

**Tasks Snapshot in one of the stages**

**![](/images/Unlocked Package CD Pipeline Tasks.png){: width="505" height="345"}**

The steps that are part of the pipeline in an individual stage are

1. [Install SFDX CLI](/Tasks/Common-Utility-Tasks/Install%20SFDX%20CLI/)
2. [Authenticate an Org](/Tasks/Common-Utility-Tasks/Authenticate%20an%20Org/)( In this case, it is authenticating against DevHub)
3. [Authenticate an Org](/Tasks/Common-Utility-Tasks/Authenticate%20an%20Org/)( In this case, it is authenticating against the Sandbox to be deployed)
4. [Install a version of the unlocked package to the target environment](/Tasks/Deployment-Tasks/Install%20an%20Unlocked%20Package/)

It is recommended to have a variable group created per environment,such as in the figure and associate it with each stage of the pipeline

![](/images/variable_group_for_envs.png){: width="812" height="440"}