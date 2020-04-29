---
title: Pull Request Validation using Scratch Org with Package Install Validation
category: Pipelines
order: 2
---

[This pipeline](https://raw.githubusercontent.com/azlamsalam/sfpowerscripts/release/SamplePipelines/sfpowerscripts-sample-pipelines/BuildDefinitions/pr-multi-stage-pipeline-validation.yml) demonstrates how you can build a pull request validation pipeline using scratch orgs. The intent of this pipeline is to validate a pull/merge request into the integration branch upon completion of a feature branch by developers. This is a YAML based multi stage pipeline to demonstrate how sfpowerscripts could be used&nbsp; to configure in YAML Azure DevOps pipeline.

This pipeline is triggered on every pull request raised against a develop/master branch depending on your git flow.

**Pipeline Snapshot**

![](/images/PR Pipeline Validation with Package.png){: width="1570" height="824"}

You can import and modify this pipeline using the file provide in the [link](https://raw.githubusercontent.com/azlamsalam/sfpowerscripts/release/SamplePipelines/sfpowerscripts-sample-pipelines/BuildDefinitions/pr-multi-stage-pipeline-validation.yml)

**Stages Involved**

The stages that are part of this pipeline and corresponding tasks are (in the exact order)

* Static Code Analysis
  1. [Install SFDX CLI](/Tasks/Common-Utility-Tasks/Install%20SFDX%20CLI/)
  2. [Validate Unlocked Package](/Tasks/Common-Utility-Tasks/Validate%20Unlocked%20Package/) (Only necessary if you are building an unlocked package)
  3. [PMD Analysis](/Tasks/Testing%20Tasks/Analyse%20apex%20code%20using%20PMD/)
* Unit Test
  1. [Install SFDX CLI](/Tasks/Common-Utility-Tasks/Install%20SFDX%20CLI/)
  2. [Authenticate an Org](/Tasks/Common-Utility-Tasks/Authenticate%20an%20Org/) (In this case, it is authenticating against DevHub)
  3. [Create/Delete a scratch org](/Tasks/Common-Utility-Tasks/Create%20and%20Delete%20a%20Scratch%20Org/) (Action: Create)
  4. [Deploy source to scratch org](/Tasks/Deployment-Tasks/Deploy%20Source%20to%20Org/) (Deploy)
  5. [Trigger Apex Tests in the scratch org](/Tasks/Testing%20Tasks/Trigger%20Apex%20Test/)
  6. [Validate the apex test coverage in the org](/Tasks/Testing%20Tasks/Validate%20Apex%20Test/)
  7. [Create/Delete a scratch org](/Tasks/Common-Utility-Tasks/Create%20and%20Delete%20a%20Scratch%20Org/) (Action: Delete)
* CI Package Test
  1. [Install SFDX CLI](/Tasks/Common-Utility-Tasks/Install%20SFDX%20CLI/)
  2. [Authenticate an Org](/Tasks/Common-Utility-Tasks/Authenticate%20an%20Org/) (In this case, it is authenticating against DevHub)
  3. [Create/Delete a scratch org](/Tasks/Common-Utility-Tasks/Create%20and%20Delete%20a%20Scratch%20Org/) (Action: Create)
  4. [Create a new version of SFDX Unlocked Package](/Tasks/Packaging-Tasks/Create%20SFDX%20Unlocked%20Package/)
  5. [Install an Unlocked Package to an Org](/Tasks/Deployment-Tasks/Install%20an%20Unlocked%20Package/)
  6. [Trigger Apex Tests in the scratch org](/Tasks/Testing%20Tasks/Trigger%20Apex%20Test/)
  7. [Validate the apex test coverage in the org](/Tasks/Testing%20Tasks/Validate%20Apex%20Test/)
  8. [Create/Delete a scratch org](/Tasks/Common-Utility-Tasks/Create%20and%20Delete%20a%20Scratch%20Org/) (Action: Delete)

**Pipeline Trigger**<br><br>This pipeline need to be enabled only with PR triggers, CI triggers for pipeline should be disabled. Follow this&nbsp; documentation to enable this PR trigger using this [link](https://docs.microsoft.com/en-us/azure/devops/pipelines/build/triggers?view=azure-devops&amp;tabs=classic)

&nbsp;