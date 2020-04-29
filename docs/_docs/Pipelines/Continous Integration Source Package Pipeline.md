---
title: Continous Integration Pipeline - Org Based
category: Pipelines
order: 4
---

This pipeline demonstrates how you can build a continous integration pipeline for if you are using&nbsp; an [org model of development](https://trailhead.salesforce.com/en/content/learn/modules/org-development-model)&nbsp; . Here is a snapshot of the steps we have used to configure a pipeline. The pipeline mimics creating a version number as in [Continous Integration (Unlocked Packaging) pipeline](/Pipelines/Continous%20Integration%20Unlocked%20Package%20Pipeline/) to simulate version based deployment in the release pipelines and create meaninguful dashboards

[This pipeline](https://raw.githubusercontent.com/azlamsalam/sfpowerscripts/release/SamplePipelines/sfpowerscripts-sample-pipelines/BuildDefinitions/Source%20Package%20Build%20using%20sfpowerscripts.json) is triggered on every successfull completion of a feature branch into the develop/master branch. If the frequency is quite high, you can look into utilizing \\\[ci skip\\\] in front of the commit message to skip a trigger of this pipeline

**Pipeline Snapshot**

**![](/images/Org Development CI Pipeline.png){: width="506" height="259"}**

&nbsp;

You can import and modify this pipeline using the file provide in the [link](https://raw.githubusercontent.com/azlamsalam/sfpowerscripts/release/SamplePipelines/sfpowerscripts-sample-pipelines/BuildDefinitions/Source%20Package%20Build%20using%20sfpowerscripts.json)

**Tasks Involved**

The steps that are part of this pipeline are (in the exact order)

1. [Increment the version number](/Tasks/Packaging-Tasks/Increment%20Version%20number%20of%20a%20package/) ( optional step, if you want to increment the build number or any segment number)
2. [Create a new version of the source package](/Tasks/Packaging-Tasks/Create%20Source%20based%20Packaging/)

**Pipeline Trigger**<br><br>This pipeline need to be enabled only with CI triggers, PR triggers for pipeline should be disabled. Follow this&nbsp; documentation to enable this CI trigger using this [link](https://docs.microsoft.com/en-us/azure/devops/pipelines/build/triggers?view=azure-devops&amp;tabs=classic)