---
title: Run a static analysis of apex classes with PMD
category: Testing \ Code Quality Tasks
order: 5
---

This task is used to run a static analyis of the apex classes in a project directory using PMD. This is a task execution wrapper around the command sfpowerkit:source:pmd which you can read [here](https://github.com/Accenture/sfpowerkit)

**Prerequisites**

Please&nbsp; note [Install SFDX with Sfpowerkit&nbsp;](/Tasks/Common-Utility-Tasks/Install%20SFDX%20CLI/) task is added to the pipeline before utilizing this task



**Task Snapshot**

**![](/images/Analyze apex classes using pmd .png){: width="929" height="587"}**

This task attaches the code analysis result into the build artifacts and also provides a timeline update in the build summary page. Please note this enahancement only works with 'Classic' pipelines only

![](/images/Build Analysis Summary.PNG){: width="1509" height="667"}


This task when used in a build pipeline features a report window that gets displayed along with the logs. Please note there
**![](/images/PMDDashbboard.png){: width="929" height="587"}**

&nbsp;

&nbsp;

**Task Version and Details**

id: sfpwowerscripts-analyzewithpmd-task

version: 4.3.10

**Input Variables**

* **Source directory that needs to be analyzed(directory)**

The directory that needs to be analyzed, If ignored, the sfpowerkit plugin will pickup the default directory mentioned in the sfdx-project.json.

* **Select the ruleset to be used for analysis(ruleset)**

sfpowerkit comes with a default ruleset, Select the picklist to 'custom' if you want to utilize your own ruleset

* **Path to the ruleset(rulesetpath)**

If you select a custom ruleset option, provide the ruleset path for PMD

* **Format for the static analysis to be displayed in the console and written to the result file(format)**

Select the format for the code analysis report to be generated, All the options as of PMD 6.18.0 are supported

* **Output file (outputPath)**

Provide the name or path to the file if you want the report to be saved to a particular location, Ignoring it will result in using the default options as of sfpowerkit. Irrespective of this, the result of PMD analysis will be uploaded into the build artifacts

* **Report the build as failure if there is critical defects(isToBreakBuild)**

Select this option if you want the build to be failed, if PMD observes any critical directory

* **Project Directory (project\_directory)**

  Leave it blank if the sfdx-project.json is in the root of the repository, else provide the folder directory containing the sfdx-project.json

* **Send Anonymous Usage Telemetry (isTelemetryEnabled)**

   Enable this flag to send anonymous usage telemetry to track usage and bring further improvements to this task


**Output Variables**

**Control Options**

**Gotcha's**

**Changelog**

* 4.3.10 Minor Fixes for buffer size 
* 4.3.0  Updated with minor changes for the data to be displayed in PMD Analysis Tab
* 4\.0.1 Updated with Telemetry
* 3\.1.0 Initial Version