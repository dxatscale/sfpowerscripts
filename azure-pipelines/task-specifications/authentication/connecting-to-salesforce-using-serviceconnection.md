# Connecting to Salesforce Org using ServiceConnection

sfpowerscripts azure pipelines extension features a service connection which would enable one to authenticate the Org’s using [Azure DevOps Service Connection feature](https://docs.microsoft.com/en-us/azure/devops/pipelines/library/service-endpoints?view=azure-devops&tabs=yaml). This would enable connection to Salesforce org’s to be managed project wide or even organization wide \(using the sharing ability of service connections\) without resorting to variables or variable groups.

{% tabs %}
{% tab title="Creating a Service Connection" %}
![Select the Salesforce Service Connection](../../../.gitbook/assets/Selecting%20Service%20Connection.PNG)

1. Open the **Service connections** page from the [project settings page](https://docs.microsoft.com/en-us/azure/devops/project/navigation/go-to-service-page?view=azure-devops#open-project-settings). 
2. Choose **+ New service connection** and select **Salesforce** type of service connection.

 
{% endtab %}

{% tab title="Configuring the Service Connection" %}
![Configure the service connection](../../../.gitbook/assets/Salesforce%20Service%20Connection.PNG)



1. Fill in the parameters for the service connection. The list of parameters differs for each type of service connection - see the [following list](https://docs.microsoft.com/en-us/azure/devops/pipelines/library/service-endpoints?view=azure-devops&tabs=yaml#ep-types).
2. Decide if you want the service connection to be accessible for any pipeline by setting the **Allow all pipelines to use this connection** option. This option allows pipelines defined in YAML, which are not automatically authorized for service connections, to use this service connection. See [Use a service connection](https://docs.microsoft.com/en-us/azure/devops/pipelines/library/service-endpoints?view=azure-devops&tabs=yaml#use-connection).
{% endtab %}
{% endtabs %}

Once a service connection is created, it could be used with ‘Authenticating a Salesforce Org’ task in Pipelines

{% hint style="danger" %}
The service connection currently features only credentials based authentication and other modes of authentication will be available in the future.  We have noticed high failure rates when using credential based authentication when utilized in conjunction with Create Scratch Org Tasks
{% endhint %}

