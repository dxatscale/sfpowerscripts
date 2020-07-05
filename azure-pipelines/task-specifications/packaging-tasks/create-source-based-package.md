# Creates a new  version of  Source Based Package

| Task ID | Latest version |
| :--- | :--- |
| sfpwowerscripts-createsourcepackage-task | 10.0.1 |

This task is used to create a build artifact for a package directory  in your project typically to be used for  org based deployment / pre/post metadata installation of an unlocked package or using a hybrid \(org+unlocked development model\), which can then be associated with a release pipeline. You can read about [`checkout artifact task` ](../deployment-tasks/checkout-a-build-artifact.md)to understand further how both are interrelated.

**Task Snapshot**

![](../../../.gitbook/assets/screen-shot-2020-07-03-at-11.09.14-pm.png)

#### Parameters

{% tabs %}
{% tab title="Input" %}
Classic Designer Labels are in **Bold,**  YAML Variables are in _italics_

**Name of the package /** _package_  
****Provide the name of the package.

**The version number of the package to be created” /** _version\_number_  
The format is `major.minor.patch.buildnumber` . This will override the build number mentioned in the `sfdx-project.json`. Consider running the [Increment Version Number task](../utility-tasks/increment-version-number-of-a-package.md) before this task and passing the `sfpowerscripts_incremented_project_version` variable as an input to this field. 

**Only run task if package has changed /** _isDiffCheck_  
Enable this option to conditionally build the source package only if there has been a change to the package. To determine whether a package has changed, also enable 'Tag latest commit ID with package name and version'.

**Tag latest commit ID with package name and version /** _isGitTag_  
Enable this option to tag the latest commit ID with an annotated Git tag that shows the package name and version. To push the tag to your repository, please refer to [Execute Post Steps after Creating a Package](execute-post-steps-after-creating-a-package.md). 

**Project Directory /** _project\_directory_  
This parameter may be left blank if the `sfdx-project.json` is in the root of the repository, else provide the folder directory containing the `sfdx-project.json` .
{% endtab %}

{% tab title="Output" %}
**sfpowerscripts\_package\_version\_number**

The version number of the package that was created**.**
{% endtab %}

{% tab title="YAML" %}
```text
steps:
- task: sfpwowerscripts-createsourcepackage-task@<version>
  displayName: 'Creates a new version of Source Based Package for <mypackage>'
  inputs:
    package: <mypackage>
    version_number: <'$(sfpowerscripts_incremented_project_version)'>
    isDiffCheck: false
    isGitTag: false
    project_directory: [dir]
```
{% endtab %}
{% endtabs %}

**Changelog**

* 10.0.1 
  * Removed Telemetry Collection
  * Added Options to tag a package
  * Added Options only to create a package if there is only change
* 7.0.5 Refactored to use revamped folder structure
* 6.0.0 Support for creation of multiple packages in a single build such as in a MonoRepo
* 5.1.0 Minor changes in artifact that is getting stored
* 5.0.1 Updated with Telemetry
* 4.0.0 Initial Version

