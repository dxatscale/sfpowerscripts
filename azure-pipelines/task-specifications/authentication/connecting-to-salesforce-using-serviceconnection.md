# Connecting to Salesforce Org using ServiceConnection

sfpowerscripts azure pipelines extension features a service connection which would enable one to authenticate the Org’s using [Azure DevOps Service Connection feature](https://docs.microsoft.com/en-us/azure/devops/pipelines/library/service-endpoints?view=azure-devops&tabs=yaml). This would enable connection to Salesforce org’s to be managed project wide or even organization wide \(using the sharing ability of service connections\) without resorting to variables or variable groups.

{% hint style="danger" %}
The service connection currently features only credentials based authentication and other modes of authentication will be available in the future.  We have noticed high failure rates when using credential based authentication when utilized in conjunction with Create Scratch Org Tasks
{% endhint %}

{% tabs %}
{% tab title="Creating a Service Connection" %}
![Select the Salesforce Service Connection](../../../.gitbook/assets/selecting-service-connection.png)
{% endtab %}

{% tab title="Configuring the Service Connection" %}
![Configure the service connection](../../../.gitbook/assets/salesforce-service-connection.png)
{% endtab %}
{% endtabs %}



Once a service connection is created, it could be used with ‘Authenticating a Salesforce Org’ task in Pipelines

