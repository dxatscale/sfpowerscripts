# Continous Integration Pipeline - Org Based

This pipeline demonstrates how you can build a continuous integration pipeline for if you are using  an [org model of development](https://trailhead.salesforce.com/en/content/learn/modules/org-development-model)  . Here is a snapshot of the steps we have used to configure a pipeline. The pipeline mimics creating a version number as in [Continous Integration \(Unlocked Packaging\) pipeline](continous-integration-pipeline-unlocked-package.md) to simulate version based deployment in the release pipelines and create meaningful dashboards

[This pipeline](https://raw.githubusercontent.com/azlamsalam/sfpowerscripts/release/SamplePipelines/sfpowerscripts-sample-pipelines/BuildDefinitions/Source%20Package%20Build%20using%20sfpowerscripts.json) is triggered on every successful completion of a feature branch into the develop/master branch. If the frequency is quite high, you can look into utilizing \\[ci skip\\] in front of the commit message to skip a trigger of this pipeline

**Pipeline Snapshot**

You can import and modify this pipeline using the file provide in the [link](https://raw.githubusercontent.com/azlamsalam/sfpowerscripts/release/SamplePipelines/sfpowerscripts-sample-pipelines/BuildDefinitions/Source%20Package%20Build%20using%20sfpowerscripts.json)

**Tasks Involved**

The steps that are part of this pipeline are \(in the exact order\)

1. [Increment the version number](../task-specifications/utility-tasks/increment-version-number-of-a-package.md) \( optional step, if you want to increment the build number or any segment number\)
2. [Create a new version of the source package](../task-specifications/packaging-tasks/create-source-based-package.md)



{% hint style="warning" %}
This pipeline need to be enabled only with CI triggers, PR triggers for pipeline should be disabled. Follow this  documentation to enable this CI trigger using this [link](https://docs.microsoft.com/en-us/azure/devops/pipelines/build/triggers?view=azure-devops&tabs=classic)
{% endhint %}

