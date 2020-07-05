# Execute Post Steps after Creating a Package

| Task ID | Latest Version |
| :--- | :--- |
| sfpowerscripts-postcreatepackage-task | 1.0.1 |

This task is intended to be added to the end of a pipeline, where its responsibility is to create and push Git tags.

![](../../../.gitbook/assets/screen-shot-2020-07-06-at-9.24.53-am.png)

### Parameters

{% tabs %}
{% tab title="Input" %}
**Select the version control provider /** _versionControlProvider_

Select the version control provider that is hosting your source code.

_**GitHub Connection /**_ github\_connection

Specify the service connection name for your GitHub connection. Please note this service connection have permissions to read to the corresponding repository. Learn more about service connections [here](https://aka.ms/AA3am5s).

**BitBucket Connection /** _bitbucket\_connection_

Specify the service connection name for your BitBucket connection. Please note this service connection have permissions to read to the corresponding repository. Learn more about service connections [here](https://aka.ms/AA3am5s).

**GitHub Enterprise Connection** _/ github\_enterprise\_connection_

Specify the service connection name for your Git Hub Enterprise connection. Please note this service connection have permissions to read from the corresponding repository. Learn more about service connections [here](https://aka.ms/AA3am5s).

**Username** _/ username_

When 'Other Git' is selected as the version control provider, provide the username credential required for authentication.

**Password** _/ password_ 

When 'Other Git' is selected as the version control provider, provide the password credential required for authentication.
{% endtab %}

{% tab title="Output" %}
None
{% endtab %}
{% endtabs %}



