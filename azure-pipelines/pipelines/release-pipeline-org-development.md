---
description: Deploy Stage
---

# Release Pipeline - Org Based Deployment

Release pipelines are one of the most exciting benefits of using Azure Pipelines, which is not just for Continuous Integration but can also act us an automated release orchestrator. This sample pipeline demonstrates how to orchestrate during an org wide development model.

This pipeline can be triggered manually by some one releasing a previously build artifact to the the environment or automated. This could be automated using the various mechanisms available in Azure Pipelines

**Pipeline Snapshot**

{% tabs %}
{% tab title="Release Pipeline " %}
![A sample pipeline demonstrating the path to production](../../.gitbook/assets/source-package-cd-pipeline-path.png)
{% endtab %}

{% tab title="Tasks in a stage" %}
![Minimal Tasks in a give stage deploying the artifact to the environment](../../.gitbook/assets/source-package-cd-pipeline-tasks%20%281%29.png)
{% endtab %}
{% endtabs %}

**Tasks Snapshot in one of the stages**

The steps that are part of the pipeline in an individual stage are

1. [Checkout the build artifact](../task-specifications/deployment-tasks/checkout-a-build-artifact.md)
2. [Install SFDX CLI](../task-specifications/utility-tasks/install-sfdx-cli-with-sfpowerkit.md)
3. [Authenticate an Org](../task-specifications/authentication/authenticate-an-org.md)\( In this case, it is authenticating against the Sandbox to be deployed\)
4. [Deploy a Package \(Source Format\) to Org](../task-specifications/deployment-tasks/deploy-a-source-repo-to-org.md)

It is recommended to have a variable group created per environment  and associate it with each stage of the pipeline

{% hint style="info" %}
Please note, we still recommend at this stage to use classic pipelines for Continuous Delivery. YAML Pipelines are missing some elements like Manual Intervention which are essential for modelling Salesforce Deployment
{% endhint %}

