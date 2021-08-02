---
description: Deploy your packages to an org
---

# Deploy

## Deploy

Given a directory of artifacts and a target org, the **deploy** command will deploy the packages to the target org according to the sequence defined in the project configuration file.

The **deploy** command removes the overhead of scripting individual package deployments. The packages to deploy and order of deployment is automatically decoded from the project configuration file carried inside the packages \(From Release 19\)

{% hint style="info" %}
For the deploy command to work, the artifacts must be created from the same source respository
{% endhint %}

### Sequence of Activities

The deploy command runs through the following steps

* Reads all the sfpowerscripts packages provided through the artifact directory  
* Unzips the artifacts and finds the latest sfdx-project.json.ori  to determine the deployment order, if this particular file is not found \(if the artifact is built from an earlier sfpowerscripts build/create - Release 18 or below\), it needs sfdx-project.json on the repo  
* Install the packages from the provided artifact directory to the target org based on the deployment order

### Pre/Post deployment script for a package

In some situations, you might need to execute a pre/post deployment script to do manipulate some aspect on the org before or after being deployed to the org. **sfpowerscripts** allow you to provide a path to a shell script \(Mac/Unix\) / batch script \(on windows\). The script will be provided with the following parameters which could be utilised to write your logic

For eg: if you want to trigger an anonymous apex script after the installation of the package, you will create a script file similar to below and then add the path to the **postDeploymentScript** property of your package

```text
# $1 package name
# $2 org

sfdx force:apex:execute -f scripts/datascript.apex -u $2
```

### Ignoring a package from being deployed

One could use the `ignoreOnStage:[ "deploy" ]` property to mark which packages should be skipped by the deploy command. If you want a selective skip, that is skip a particular package being deployed to specific org, you could use the property

```text
         `skipDeployOnOrgs: ["username/alias","username/alias"]`
```

If the username/alias passed as a flag to the command matches the array, then this package will be skipped on deployment

### Deploy a package everytime

There are some certain situations, due to integrity concerns \(especially around data or org-specific source packages\) that need to be installed every time, as some earlier packages if deployed in the sequence would overwrite certain components. To solve this specific challenge utilize `alwaysDeploy:true` and the particular package will always be deployed. **Please note this package has to be always available in the artifacts directory to enable this functionality.**

### **Deploy packages based on a target org**

The `--baselineorg` parameter allows you to specify the alias or username of an org against which to check whether the incoming package versions have already been installed and form a deployment plan.This overrides the default behaviour which is to compare against the deployment target org. This is an optional feature which allows to ensure each org's are updated with the same deployment across every org's in the path to production.

![](../.gitbook/assets/image%20%2810%29.png)

### Using deploy in a non-linear pipeline

It is often a recommended practice to split CI/CD into [asynchronous pipelines](https://worklifenotes.com/2020/06/04/7-best-practices-modern-cicd/). In this particular pattern, CI pipelines are responsible for uploading artifacts into an artifact repository \( eg: Jfrog Artifactory, Azure Artifacts\) and CD pipelines then deploys these artifacts.

In this particular instance, this is a rough schematic for designing such pipelines are as follows. As you could see, from the below diagram, deploy could be used in the CD pipelines using only the artifacts from the artifact repository without the need for version control system to be hooked into the CD pipelines.

