# Install SFDX CLI with sfpowerkit

| Task Id | Version |
| :--- | :--- |
| sfpwowerscript-installsfdx-task | 7.0.14 |

This task is usually the first task of any pipeline you build using sfpowerscripts. It installs the SFDX CLI along with the open source extension ‘sfpowerkit’.

Please note this task is not supported in Hosted Mac Agents as of now

## **Task Snapshot**

**Parameters**

{% tabs %}
{% tab title="Input Parameters" %}
Classic Designer Labels are in **Bold,** YAML Variables are in _italics_

* **Override Default Salesforce API Version used by the CLI and Plugins /** _salesforce\_api\_version_

  Provide an API version which the CLI commands should utilize, if ignored, the latest GA version used by the sfdx cli is used

* **SFDX CLI Version /** _sfdx\_cli\_version_

  By default, the latest SFDX CLI version will be installed. You can override this by providing the version number found in [Salesforce CLI Release Notes](https://developer.salesforce.com/media/salesforce-cli/releasenotes.html)

* **SFPowerkit Version /** _sfpowerkit\_version_

  By default, the latest SFPowerkit version will be installed. You can override this by providing the version number found in [SFPowerkit Release Notes](https://github.com/Accenture/sfpowerkit/releases)

* **Additional Plugins to be installed /** _plugins_

  Provide additional sfdx plugins to be installed, when this task is run. The format to be followed is **pluginame1@version,pluginname2@version** and so forth.
{% endtab %}

{% tab title="Output Parameters" %}
None
{% endtab %}

{% tab title="YAML Sample" %}
```text
#Install SFDX 
- task: sfpwowerscript-installsfdx-task@6
  displayName: Install SFDX
```
{% endtab %}
{% endtabs %}

\*\*\*\*

**Changelog**

* 7.0.8 Update Core dependency
* 7.0.4 Updated major versions to remove telemetry collection
* 6.0.5 Refactored to use revamped folder structure
* 5.0.3 Minor formatting fixes
* 5.0.0 Add support for overriding api version to be used in commands
* 4.0.5 Introduce support to work on Hosted Windows Agents and also support installation of additional plugins
* 3.2.1 Updated with Telemetry
* 2.0.0 Task updated with new id
* 1.3.0 Deprecated the task 
* 1.2.0 Initial Version

