# Continous Integration Pipeline - Unlocked Package

This pipeline demonstrates how you can build a continous integration pipeline for an unlocked package. Here is a snapshot of the steps we have used to configure a pipeline.

[This pipeline](https://raw.githubusercontent.com/azlamsalam/sfpowerscripts/release/SamplePipelines/sfpowerscripts-sample-pipelines/BuildDefinitions/Unlocked%20Package%20Build%20using%20sfpowerscript.json) is triggered on every successfull completion of a feature branch into the develop/master branch. If the frequency is quite high, you can look into utilizing \[ci skip\] in front of the commit message to skip a trigger of this pipeline

**Pipeline Snapshot**

You can import and modify this pipeline using the file provide in the [link](https://raw.githubusercontent.com/azlamsalam/sfpowerscripts/release/SamplePipelines/sfpowerscripts-sample-pipelines/BuildDefinitions/sfpowerscripts-sample-pipelines/BuildDefinitions/Unlocked%20Package%20Build%20using%20sfpowerscript.json)

**Tasks Involved**

The steps that are part of this pipeline are \(in the exact order\)

1. [Install SFDX CLI](../task-specifications/utility-tasks/install-sfdx-cli-with-sfpowerkit.md)
2. [Authenticate an Org](../task-specifications/authentication/authenticate-an-org.md)\( In this case, it is authenticating against DevHub\)
3. [Increment the version number](../task-specifications/utility-tasks/increment-version-number-of-a-package.md) \( optional step, if you want to increment the build number or any segment number\)
4. [Create a new version of the unlocked package](https://sfpowerscripts.com/Tasks/Packaging-Tasks/Create%20SFDX%20Unlocked%20Package/)

**Pipeline Trigger**

This pipeline need to be enabled only with CI triggers, PR triggers for pipeline should be disabled. Follow this  documentation to enable this CI trigger using this [link](https://docs.microsoft.com/en-us/azure/devops/pipelines/build/triggers?view=azure-devops&tabs=classic)

