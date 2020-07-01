# Authenticate a Salesforce Org

| Task Id | Version |
| :--- | :--- |
| sfpwowerscript-authenticateorg-task | 9.0.5 |

This task is used to authenticate against a salesforce org to do further actions. The task supports authentication to org using JWT \(recommended\) or using username/password/security. The org can then further accessed by utilizing the provided alias. It is highly recommended to create a service user while using this task.

> To read more about JWT based authentication and to generate the private key files, please follow the instruction [here](https://developer.salesforce.com/docs/atlas.en-us.sfdx_dev.meta/sfdx_dev/sfdx_dev_auth_jwt_flow.htm).

**Prerequisites**

Please note [Install sfdx with sfpowerkit](../utility-tasks/install-sfdx-cli-with-sfpowerkit.md)  task is added to the pipeline before utilizing this task

#### **Task Snapshot**

{% tabs %}
{% tab title="Service Connection" %}
![Authenticate a Salesforce Org using Service Connection](../../../.gitbook/assets/authenticate-a-salesforce-org-using-serviceconnection.png)
{% endtab %}

{% tab title="JWT" %}
![Authenticate a Salesforce Org using JWT](../../../.gitbook/assets/authenticate-a-salesforce-org-using-jwt.png)
{% endtab %}

{% tab title="Credentials" %}
![Authenticate a Salesforce Org using credentials](../../../.gitbook/assets/authenticate-a-salesforce-org-using-credentials.png)
{% endtab %}
{% endtabs %}

#### Parameters

{% tabs %}
{% tab title="Input Parameters " %}
Classic Designer Labels are in **Bold,**  YAML Variables are in _italics_

* **Authentication Method  /** _method_

  The method to authenticate this org. Available methods are either using Service Connection, JWT or using Credentials \(Username/Password/Security Token\)  

* **Salesforce Connection /**  _salesforce\_connection_

  
  This option is required only if the method of authentication is using the service connection. Provide the name of the service connection in this field  

* **Secure File /** _jwt\_key\_file_

  Secure file containing the private key, used only if the authentication method is JWT based. Instructions to store the private key as a secure file are available [here](https://docs.microsoft.com/en-us/azure/devops/pipelines/library/secure-files?view=azure-devops)  

* **Username /**  _username_

  Username for the authenticated user \(available in both JWT and Credentials based authentication mode\)  

* **clientid /** _clientid_

  OAuth client ID \(sometimes called the consumer key\) \(available only in JWT based authentication mode\)  

* **Password /** _password_

  Password for the authenticated user \(available only in Credentials based authentication mode\)  

* **Security Token /**  _securitytoken_

  Security Token for this particular user, Security Token requirement can be removed by ensuring the particular user is allowed to connect to Salesforce from whitelisted IP ranges that include the IP ranges where Azure hosted agents will be executed. \(available only in Credentials based authentication mode\)  

* **Alias /** _alias_

  Alias of the org to be used in subsequent tasks \(available in both JWT and Credentials based authentication mode\)  

* **Authenticate this org as a DevHub/Production /** _isDevhub_

  Enable this variable, if the org is to be authenticated as a DevHub/Production, this is required incase this org is used in subsequent task to create a scratch org or to create an unlocked package \(available in both JWT and Credentials based authentication mode\)
{% endtab %}

{% tab title="Output Parameters" %}
**N/A**

\*\*\*\*
{% endtab %}

{% tab title="Control Options" %}
**N/A**
{% endtab %}

{% tab title="YAML Sample" %}
```text
# Authenticate to an org using Service Connection
  - task: sfpwowerscript-authenticateorg-task@9
    displayName: "Authenticate  HubOrg using ServiceConnection"
    inputs:
      salesforce_connection: "devhub"
      alias: HubOrg
```
{% endtab %}
{% endtabs %}

{% hint style="success" %}
**JWT based authentication is the preferred approach and it is intended for CI/CD based non human authentication**
{% endhint %}

{% hint style="warning" %}
 **A newly established JWT Connection will take a few minutes to establish. Please wait a few minutes before you trigger the execution** 
{% endhint %}

{% hint style="warning" %}
**Both Service Connection and Credential based authentication  utlilizes**`sfpowerkit:auth:login` **for authentication and is quite unstable when utilized for creating ScratchOrg. Utilize this only for login to the sandboxes for a short running task**
{% endhint %}



**Changelog**

* 8.0.5 Refactored to use revamped folder structure
* 7.0.0 Add clarity for DevHub / Production for authentication
* 6.0.0 Support Service Connection based Authentication
* 5.2.0 Updated to work on Hosted Windows Agents
* 5.1.1 Updated with Telemetry
* 4.1.0 New version with updated id
* 3.0.0 Deprecated Version
* 3.0.0 Initial Version

