---
title: Getting Started 
---

Here is how to get started with SFPowerscripts, if you want to explore the whole sample pipelines is utilizing Azure DevOps Demo Generator. If you are already experienced with Azure Pipelines, skip these steps and directly import the sample pipelines once the extension is installed or start creating the pipelines the way you prefer

<iframe width="560" height="315" src="https://www.youtube.com/embed/BeWfwvw6VVQ" frameborder="0" allow="accelerometer; autoplay; encrypted-media; gyroscope; picture-in-picture" allowfullscreen=""></iframe>

1\. Sign into your Azure Pipelines Account. If you are not an Azure Pipelines customer, it is quite easy to get one going. Follow the links [here](https://azure.microsoft.com/en-au/services/devops/)

2\. Install the sfpowerscripts extension into your Azure Pipelines org from [here](https://marketplace.visualstudio.com/items?itemName=AzlamSalam.sfpowerscripts)

3\. Navigate to Azure DevOps Demo Generator at [https://azuredevopsdemogenerator.azurewebsites.net/](https://azuredevopsdemogenerator.azurewebsites.net/)<br><br>![](/images/Azure Devops Demo generator.png){: width="1443" height="962"}

4\. Select your organization,

5\. Type in a project name for the to be created project

![](/images/create new project.png){: width="1323" height="386"}

6\. Click on choose template and then navigate to the private tab

7\. Choose URL and mention the following url&nbsp;

[sfpowerscripts sample pipelines](https://github.com/azlamsalam/sfpowerscripts/releases/download/11.0.59/sfpowerscripts-sample-pipelines.zip)

![](/uploads/gettingstarted-samplepipelines.PNG){: width="1906" height="549"}

8\. Click on Create Project and wait for the project to be completed

9\. Navigate to the newly created project

10\. Confirm the build and release pipelines are created, start modifying the following for the pipelines to work

* Repositories

* Variable Group per environment

  It is recommended to have a variable group created per environment,such as in the figure and associate it with each stage of the pipeline

![](/images/variable_group_for_envs.png){: width="812" height="440"}

* Setting up connected app authentication, the current pipeline is authenticated using credentials, it is better to set it up using JWT, To read more about JWT based authentication and to generate the private key files, please follow the instruction&nbsp;[here](https://developer.salesforce.com/docs/atlas.en-us.sfdx_dev.meta/sfdx_dev/sfdx_dev_auth_jwt_flow.htm) and follow the instructions for the auth task here

* Fixing the variables association in the created pipelines, Read more about the pipelines [here](/Pipelines/Continous%20Integration%20Source%20Package%20Pipeline/)