---
title: Authenticate an Org
category: Common \ Utility Tasks
order: 2
---

This task is used to authenticate against a salesforce org to do the required further actions. The task supports authentication to org using JWT (recommended) or using username/password/security. The org can then further accessed by utilizing the provided alias. It is higly recommended to create a service user while using this task.

To read more about JWT based authentication and to generate the private key files, please follow the instruction&nbsp;[here](https://developer.salesforce.com/docs/atlas.en-us.sfdx_dev.meta/sfdx_dev/sfdx_dev_auth_jwt_flow.htm).

*
**Prerequisites**

Please note [Install SFDX with Sfpowerkit](/Tasks/Common-Utility-Tasks/Install%20SFDX%20CLI/) task is added to the pipeline before utilizing this task


**Task Snapshot**

**Authenticate a Salesforce Org using Service Connection**
![](/images/Authenticate a Salesforce Org using ServiceConnection.png){: width="951" height="629"}


**Authenticate a Salesforce Org using JWT**
![](/images/Authenticate a Salesforce Org using JWT.png){: width="951" height="629"}

**Authenticate a Salesforce Org using Credentials**
![](/images/Authenticate a Salesforce Org using Credentials.png){: width="951" height="629"}  





**Task Version and Details**

id: sfpwowerscript-authenticateorg-task

version: 7.0.0

**Input Variables \[Visual Designer Labels / Yaml variables\]**

* **Authentication Method(method)**

  The method to authenticate this org. Available methods are either using Service Connection, JWT or using Credentials (Username/Password/Security Token)

* **Salesforce Connection(salesforce_connection)**
  This option is required only if the method of authentication is using the service connection. Provide the name of the service connection in this field 


* **Secure File(jwt\_key\_file)**

  Secure file containing the private key, used only if the authentication method is JWT based. Instructions to store the private key as a secure file are avaiable [here](https://docs.microsoft.com/en-us/azure/devops/pipelines/library/secure-files?view=azure-devops)

* **Username(username)**

  Username for the authenticated user (available in both JWT and Credentials based authentication mode)

* **clientid(clientid)**

  OAuth client ID (sometimes called the consumer key) (available only in JWT based authentication mode)

* **Password(password)**

  Password for the authenticated user (available only in Credentials based authentication mode)

* **Security Token(securitytoken)**

  Security Token for this particular user, Security Token requirement can be removed by ensuring the particular user is allowed to connect to Salesforce from whitelisted IP ranges that include the IP ranges where Azure hosted agents will be executed. (available only in Credentials based authentication mode)

* **Alias(alias)**

  Alias of the org to be used in subsequent tasks (available in both JWT and Credentials based authentication mode)

* **Authenticate this org as a DevHub/Production(isdevhub)/**

  Enable this variable, if the org is to be authenticated as a DevHub/Production, this is required incase this org is used in subsequent task to create a scratch org or to create an unlocked package (available in both JWT and Credentials based authentication mode)

* **Send Anonymous Usage Telemetry (isTelemetryEnabled)**

   Enable this flag to send anonymous usage telemetry to track usage and bring further improvements to this task

**Output Variables**

None

**Control Options**

None

**Gotcha's**

JWT based authentication is the preferred approach and it is intendended for CI/CD based non human authentication

**Changelog**

* 7.0.0 Add clarity for Dehub/Production for authentication
* 6.0.0 Support Service Connection based Authentication
* 5.2.0 Updated to work on Hosted Windows Agents
* 5.1.1 Updated with Telemetry
* 4.1.0 New version with updated id
* 3.0.0 Deprecated Version
* 3.0.0 Initial Version
