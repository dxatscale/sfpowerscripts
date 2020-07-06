# Validate Apex Test Coverage

| Task Id | Version |
| :--- | :--- |
| sfpwowerscript-validateapextestcoverage-task | 4.0.4 |

This task is used to validate the apex test coverage of an org

**Prerequisites**

[Install SFDX with Sfpowerkit](../utility-tasks/install-sfdx-cli-with-sfpowerkit.md) task must be added to the pipeline before utilizing this task

**Task Snapshot**

![](../../../.gitbook/assets/validate-apex-test-coverage.png)

**Parameters**

{% tabs %}
{% tab title="Input Parameters" %}
Classic Designer Labels are in **Bold,**  YAML Variables are in _italics_

* **Alias or username of the target org** / _targetOrg_ The alias or username of the target org
* **Send anonymous usage telemetry** / _isTelemetryEnabled_ Enable to send anonymous usage telemetry to track usage and bring further improvements to this task
{% endtab %}

{% tab title="Output Parameters" %}
None
{% endtab %}

{% tab title="Control Options" %}
None
{% endtab %}

{% tab title="YAML Example" %}
```text
          - task: sfpwowerscript-validateapextestcoverage-task@2
            displayName: Validate Apex Test Coverage
            inputs:
                target_org: 'scratchorg'
                test_coverage: '36'
                isTelemetryEnabled: true
```
{% endtab %}
{% endtabs %}

