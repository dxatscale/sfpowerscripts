---
title: Connecting to Salesforce using ServiceConnection
category: Service Connection
order: 1
---

The plugin features a service connection which would enable one to authenticate the Org's using Azure DevOps Service Connection feature. This would enable the Org's to be managed project wide without resorting to Variable Groups or variables in the pipeline.

To create a serivce connection head to Project Settings -> Pipelines -> Service Connection and select Salesforce from the dropdown

The service connection currently features only Credentials based authentication and other modes of authentication will be available in the future. 

Once a service connection is created, it could be used with 'Authenticating a Salesforce Org' task in Pipelines


**Snapshot**


**Salesforce Service Connection**

 ![](/images/Salesforce Service Connection.png)


