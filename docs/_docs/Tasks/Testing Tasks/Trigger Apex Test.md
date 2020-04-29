---
title: Trigger Apex Test
category: Testing \ Code Quality Tasks
order: 6
---

This task is used to trigger apex unit tests in an org and also captures the results as an artifact and publishes the result in the tests tab.

**![](/images/Trigger Apex Tests Test Tab.png){: width="832" height="519"}**

**Prerequisites**

Please note [Install SFDX with Sfpowerkit](/Tasks/Common-Utility-Tasks/Install%20SFDX%20CLI/) task is added to the pipeline before utilizing this task

**Task Snapshot**

**![](/uploads/trigger-apex-tests.PNG){: width="800" height="448"}**

**Task Version and Details**

id: sfpwowerscript-triggerapextest-task

version: 4.0.6

**Input Variables  - Visual Designer Labels (Yaml variables)**

* **Alias or username of the target org(target\_org)**

 Provide the alias or username of the target org

* **Test Level(testlevel)**

 Select the testlevel for this task from the possible list of values, The values include the following
  
    - RunSpecifiedTests (Run only specified tests)
    - RunApexTestSuite (Run an apex test suite)
    - RunLocalTests (Run Local Tests)
    - RunAllTestsInOrg (Run All Tests in the org)

* **Tests to be executed(specified\_tests)**

 This field will be visible only if the Test Level is RunSpecifiedTests, Provide a coma seperated list of apex test classes that is to be executed

* **Apex Test Suite(apextestsuite)**

 This field will be visible only if the Test Level is RunApexTestSuite, Provide the name of the apex test suite that should be executed with this task.

* **Wait Time (wait\_time)**

 The time this task should wait for the result to be generated. The default wait time is 60 minutes.

* **Send Anonymous Usage Telemetry (isTelemetryEnabled)**

 Enable this flag to send anonymous usage telemetry to track usage and bring further improvements to this task


**Output Variables**

None

**Control Options**

None

**Gotcha's**

None

**Changelog**


* 4.0.6  Integration of Error Logs with Github
* 3.2.0  Fixes for Post Trigger Test Task
* 3.0.18 Bugfix for stdout buffer running out
* 3.0.17 Updated with artifact upload and submitting test results in the test tab
* 2.0.1  Updated with telemetry
* 1.1.0  Initial Version