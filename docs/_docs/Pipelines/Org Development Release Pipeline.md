---
title: Release Pipeline - Org Development
category: Pipelines
order: 6
---

Release pipelines are one of the most exciting benefits of using Azure Pipelines, which is not just for Continous Integration but can also act us an automated release orchestrator. This sample pipeline demonstrates how to orchestrate during an org wide development model. We simulate the creation of an build artifact utilizing the Continous Integration Pipeline - Org Based

[This pipeline](https://raw.githubusercontent.com/azlamsalam/sfpowerscripts/release/SamplePipelines/sfpowerscripts-sample-pipelines/ReleaseDefinitions/Org%20%20Deployment%20Pipeline%20using%20sfpowerscripts.json) is manually triggered by some one releasing a previously build artifact to the the environment. This could be automated using the various mechanisms available in Azure Pipelines

**Pipeline Snapshot**

**![](/images/Unlocked Packages CD Pipeline.PNG){: width="1305" height="455"}**

&nbsp;

You can import and modify this pipeline using the file provide in the [link](https://raw.githubusercontent.com/azlamsalam/sfpowerscripts/release/SamplePipelines/sfpowerscripts-sample-pipelines/ReleaseDefinitions/Source%20Package%20Deployment%20Pipeline%20using%20sfpowerscripts.json)

**Tasks Snapshot in one of the stages**

**![](/images/Source Package CD Pipeline Tasks.png){: width="517" height="327"}**

&nbsp;

The steps that are part of the pipeline in an individual stage are

1. [Checkout the build artifact](/Tasks/Deployment-Tasks/Checkout%20a%20build%20artifact/)
2. [Install SFDX CLI](/Tasks/Common-Utility-Tasks/Install%20SFDX%20CLI/)
3. [Authenticate an Org](/Tasks/Common-Utility-Tasks/Authenticate%20an%20Org/)( In this case, it is authenticating against the Sandbox to be deployed)
4. [Deploy a&nbsp;Source Repo to Org](/Tasks/Deployment-Tasks/Deploy%20Source%20to%20Org/)

It is recommended to have a variable group created per environment,such as in the figure and associate it with each stage of the pipeline

![](/images/variable_group_for_envs.png){: width="812" height="440"}