---
title: Pull Request Validation using Scratch  Org
category: Pipelines
order: 1
---

[This pipeline](https://raw.githubusercontent.com/azlamsalam/sfpowerscripts/release/SamplePipelines/sfpowerscripts-sample-pipelines/BuildDefinitions/PR%20Source%20Format%20%5BScratch%20Orgs%5D%20using%20sfpowerscripts.json) demonstrates how you can build a pull request validation pipeline using scratch org. Here is a snapshot of the steps we have used to configure a pipeline. The intend of this pipeline is to validate a pull/merge request into the integration branch upon completion of a feature branch by developers.

This pipeline is triggered on every pull request raised against a develop/master branch depending on your git flow.

**Pipeline Snapshot**

![](/images/PR Pipeline ScratchOrg.png){: width="1570" height="824"}

You can import and modify this pipeline using the file provide in the [link](https://raw.githubusercontent.com/azlamsalam/sfpowerscripts/release/SamplePipelines/sfpowerscripts-sample-pipelines/BuildDefinitions/PR%20Source%20Format%20%5BScratch%20Orgs%5D%20using%20sfpowerscripts.json)

**Tasks Involved**

The steps that are part of this pipeline are (in the exact order)

1. [Install SFDX CLI](/Tasks/Common-Utility-Tasks/Install%20SFDX%20CLI/)
2. [Validate Unlocked Package](/Tasks/Common-Utility-Tasks/Validate%20Unlocked%20Package/) ( Only necessary if you are building an unlocked package)
3. [Authenticate an Org](/Tasks/Common-Utility-Tasks/Authenticate%20an%20Org/)( In this case, it is authenticating against DevHub)
4. [Create/Delete a scratch org](/Tasks/Common-Utility-Tasks/Create%20and%20Delete%20a%20Scratch%20Org/)( Action :Create)
5. [Deploy source to scratch org](/Tasks/Deployment-Tasks/Deploy%20Source%20to%20Org/) ( Deploy)
6. [Trigger Apex Tests in the scratch org](/Tasks/Testing%20Tasks/Trigger%20Apex%20Test/)
7. [Validate the apex test coverage in the org](/Tasks/Testing%20Tasks/Validate%20Apex%20Test/)
8. [Create/Delete a scratch org](/Tasks/Common-Utility-Tasks/Create%20and%20Delete%20a%20Scratch%20Org/)(Action :Delete) (Optional : Depending on the maintain org option used in step 4)

**Pipeline Trigger**<br><br>This pipeline need to be enabled only with PR triggers, CI triggers for pipeline should be disabled. Follow this&nbsp; documentation to enable this PR trigger using this [link](https://docs.microsoft.com/en-us/azure/devops/pipelines/build/triggers?view=azure-devops&amp;tabs=classic)

&nbsp;