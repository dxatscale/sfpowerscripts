---
title: Trigger Apex Test
category: Testing \ Code Quality Tasks
order: 6
---

This task is used to trigger apex unit tests in an org and also captures the results as an artifact and publishes the result in the tests tab.
{: .present-before-paste}

**![](/images/Trigger Apex Tests Test Tab.png){: width="832" height="519"}**
{: .present-before-paste}

**Prerequisites**
{: .present-before-paste}

Please note [Install SFDX with Sfpowerkit](/Tasks/Common-Utility-Tasks/Install%20SFDX%20CLI/) task is added to the pipeline before utilizing this task
{: .present-before-paste}

**Task Snapshot**
{: .present-before-paste}

**![](/uploads/trigger-apex-tests.PNG){: width="800" height="448"}**
{: .present-before-paste}

**Task Version and Details**
{: .present-before-paste}

id: sfpwowerscript-triggerapextest-task
{: .present-before-paste}

version: 7.0.4
{: .present-before-paste}

**Input Variables - Visual Designer Labels (Yaml variables)**
{: .present-before-paste}

* **Alias or username of the target org(target\_org)**

Provide the alias or username of the target org
{: .present-before-paste}

* **Test Level(testlevel)**

Select the testlevel for this task from the possible list of values, The values include the following
{: .present-before-paste}

~~~
- RunSpecifiedTests (Run only specified tests)
- RunApexTestSuite (Run an apex test suite)
- RunLocalTests (Run Local Tests)
- RunAllTestsInOrg (Run All Tests in the org)
~~~

* **Tests to be executed(specified\_tests)**

This field will be visible only if the Test Level is RunSpecifiedTests, Provide a coma seperated list of apex test classes that is to be executed
{: .present-before-paste}

* **Apex Test Suite(apextestsuite)**

This field will be visible only if the Test Level is RunApexTestSuite, Provide the name of the apex test suite that should be executed with this task.
{: .present-before-paste}

* **Wait Time (wait\_time)**

The time this task should wait for the result to be generated. The default wait time is 60 minutes.
{: .present-before-paste}

&nbsp;
{: .present-before-paste}

**Output Variables**
{: .present-before-paste}

None
{: .present-before-paste}

**Control Options**
{: .present-before-paste}

None
{: .present-before-paste}

**Gotcha’s**
{: .present-before-paste}

None
{: .present-before-paste}

**Changelog**
{: .present-before-paste}

* 7\.0.4 Remove Telemetry Collection
* 6\.0.4 Refactored to use revamped folder structure
* 4\.0.6 Integration of Error Logs with Github
* 3\.2.0 Fixes for Post Trigger Test Task
* 3\.0.18 Bugfix for stdout buffer running out
* 3\.0.17 Updated with artifact upload and submitting test results in the test tab
* 2\.0.1 Updated with telemetry
* 1\.1.0 Initial Version