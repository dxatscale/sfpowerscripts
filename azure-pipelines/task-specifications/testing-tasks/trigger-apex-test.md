# Trigger Apex Test

This task is used to trigger apex unit tests in an org and also captures the results as an artifact and publishes the result in the tests tab.

| **Task Id** | Version |
| :--- | :--- |
| sfpwowerscript-triggerapextest-task | 7.0.4 |

**Prerequisites**

[Install SFDX with Sfpowerkit](../utility-tasks/install-sfdx-cli-with-sfpowerkit.md) task is added to the pipeline before utilizing this task

**Task Snapshot**

![](../../../.gitbook/assets/trigger-apex-test.png)

{% tabs %}
{% tab title="Input Parameters" %}
Classic Designer Labels are in **Bold,**  YAML Variables are in _italics_

* **Alias or username of the target org** / _targetOrg_ The alias or username of the target org
* **Test Level** / _testlevel_ Select the testlevel for this task for the list of possible values: 

```text
- RunSpecifiedTests (Run only specified tests)
- RunApexTestSuite (Run an apex test suite)
- RunLocalTests (Run Local Tests)
- RunAllTestsInOrg (Run All Tests in the org)
```

* **Tests to be executed** / _specified\_tests_ A list of apex test classes to be executed, separated by a comma **Note:** This field is only visible if the Test Level is "RunSpecifiedTests"
* **Apex Test Suite** / _apextestsuite_ The name of the apex test suite to be executed **Note:** This field is only visible if the Test Level is "RunApexTestSuite"
* **Wait Time** / _wait\_time_ The time this task should wait for the result to be generated.  **Default wait time:** 60 minutes
* **Send anonymous usage telemetry /** _isTelemetryEnabled_ Send anonymous usage telemetry to track usage and bring further improvements to this task
{% endtab %}

{% tab title="Output Parameters" %}
None
{% endtab %}

{% tab title="Control Options" %}
None
{% endtab %}

{% tab title="YAML Example" %}
```text
- task: sfpwowerscript-triggerapextest-task@3
            displayName: Trigger Apex Test Task
            continueOnError: true
            inputs:
             target_org: 'scratchorg'
             testlevel: 'RunLocalTests'
             wait_time: '60'
             isTelemetryEnabled: true
```
{% endtab %}
{% endtabs %}

**Changelog**

* 6.0.4 Refactored to use revamped folder structure
* 4.0.6 Integration of Error Logs with Github
* 3.2.0 Fixes for Post Trigger Test Task
* 3.0.18 Bugfix for stdout buffer running out
* 3.0.17 Updated with artifact upload and submitting test results in the test tab
* 2.0.1 Updated with telemetry
* 1.1.0 Initial Version

