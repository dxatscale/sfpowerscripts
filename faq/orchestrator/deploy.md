---
description: Deploy your packages to an org
---

# Deploy

## What does deploy command do?

Given a directory of artifacts and a target org, the **deploy** command will deploy the packages to the target org according to the sequence defined in the project configuration file. 

The **deploy** command removes the overhead of scripting individual package deployments. The packages to deploy and order of deployment is automatically decoded from the project configuration file.  

{% hint style="info" %}
For the deploy command to work, it requires the current working directory to contain the project configuration file. Additionally, the artifacts must be created from the same source version.
{% endhint %}

## What are the sequence of steps the deploy command does?

The deploy command runs through the following steps  
- Reads all the sfpowerscripts packages provided through the artifact directory  
- Reads the sfdx-project.json and understand the order of deployment  
- Install the packages from the provided artifact directory to the target org based on the sequence mentioned in sfdx-project.json

## How do I skip a package from being deployed to an org?

Yes, you could use the `ignoreOnStage:[ "deploy" ]` property to mark which packages should be skipped by the deploy command. If you want a selective skip, that is skip a particular package being deployed to specific org, your could use the property `skipDeployOnOrgs: ["username/alias","username/alias"]` . If the username/alias passed as a flag to the command matches the array, then this package will be skipped on deployment

## 



