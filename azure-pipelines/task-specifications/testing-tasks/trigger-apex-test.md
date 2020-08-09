# Trigger Apex Test

| **Task Id** | Version |
| :--- | :--- |
| sfpwowerscript-triggerapextest-task | 8.0.0 |

This task is used to trigger apex unit tests in an org and also captures the results as an artifact and publishes the result in the tests tab.

**Prerequisites**

[Install SFDX CLI with sfpowerkit](../utility-tasks/install-sfdx-cli-with-sfpowerkit.md)  task must be added to the pipeline before utilizing this task

**Task Snapshot**

![](../../../.gitbook/assets/trigger-apex-test.png)

{% tabs %}
{% tab title="Input Parameters" %}
Classic Designer Labels are in **Bold,**  YAML Variables are in _italics_

* **Alias or username of the target org** / _targetOrg_ The alias or username of the target org 
* **Test Level** / _testlevel_ Select the testlevel for this task for the list of possible values:   -  **Run only specified tests /** _RunSpecifiedTests   -_  **Run an apex test suite** / RunApexTestSuite  -  **Run Local Tests** / RunLocalTests  -  **Run All Tests in the org** / RunAllTestsInOrg     __
* **Tests to be executed** / _specified\_tests_ A list of apex test classes to be executed, separated by a comma

{% hint style="info" %}
This field is only visible/valid  if the Test Level is "RunSpecifiedTests"
{% endhint %}

* **Apex Test Suite** / _apextestsuite_ The name of the apex test suite to be executed 

{% hint style="info" %}
This field is only visible/valid  if the Test Level is "RunApexTestSuite"
{% endhint %}

* **Run tests from a single class synchronously /** _synchronous_

  _Run tests synchronously_ 

  \_\_

* **Validate code coverage of individual classes** / _isValidateCoverage_

  Verifies whether individual classes meet the minimum code coverage requirement

* **Minimum percentage coverage required per class** / _coverageThreshold_

  Minimum coverage required per class, in order for the task to succeed

* **Package to validate /** _packageToValidate_

  Package to check for code coverage, required when _isValidateCoverage_ is true

* **Project directory /** _project\_directory_

  The project directory should contain a sfdx-project.json

* **Wait Time** / _wait\_time_ The time this task should wait for the result to be generated. 
{% endtab %}

{% tab title="Output Parameters" %}
None
{% endtab %}

{% tab title="YAML Example" %}
```text
- task: sfpwowerscript-triggerapextest-task@<version>
            displayName: Trigger Apex Test Task
            inputs:
             target_org: 'scratchorg'
             testlevel: 'RunLocalTests'
             wait_time: '60'
             isTelemetryEnabled: true
```
{% endtab %}
{% endtabs %}

**Changelog**

* 8.0.0 Validate code coverage of individual classes for Apex test suite
* 6.0.4 Refactored to use revamped folder structure
* 4.0.6 Integration of Error Logs with Github
* 3.2.0 Fixes for Post Trigger Test Task
* 3.0.18 Bugfix for stdout buffer running out
* 3.0.17 Updated with artifact upload and submitting test results in the test tab
* 2.0.1 Updated with telemetry
* 1.1.0 Initial Version

