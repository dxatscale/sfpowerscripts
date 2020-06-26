---
title: Overview
---

sfpowerscripts (azure pipelines extension) is an open source and free Azure Pipelines Extension that converts Azure Pipelines into a CI/CD platform for Salesforce.. Install the plugin from [Visual Studio Marketplace](https://marketplace.visualstudio.com/items?itemName=AzlamSalam.sfpowerscripts) and read the documentation on how to configure a highly customizable Salesforce CI/CD Pipeline.

Please note this extension only works with the newer source format based repositories test to work with both Hosted Linux and Windows Agents.

The extension features the following tasks

#### Common/Utility Tasks

* Install SFDX CLI along with SFPowerkit Plugin
* Authenticate an Org using JWT or Username/Password/Security Token
* Validate a Unlocked package for metadata coverage
* Install all package dependencies of an unlocked package
* Run apex code analysis using PMD

#### Deployment Related Tasks

* Checkout a source based artifact from Git (using PAT) / Azure Artifacts
* Deploy a source format based package to an org (scratch org/sandbox/prod)
* Deploy an unlocked package to an org
* Deploy destructive manifest to an org

#### Packaging Related Tasks

* Increment Project Version Number similar to npm version patch, which can be utilized before an unlocked / source based packaging
* Create an unlocked package
* Create a build artifact for unlocked/source based packaging, which can be utilized in Release Pipelines

#### Testing / Code Quality Related Tasks

* Trigger Apex Test
* Validate Apex Test Coverage of an org
* Validate Code Coverage of a second generation package

#### How does it work?

The extension is designed with tasks which are granular, which means all the above tasks have to be orchestrated in a valid order required to reach the required objective. This allows one to utilize other commands or extensions between the tasks and be highly effective rather than getting tied to a single task. This ensures maximum flexibility while building the pipeline.

For eg: a Pull Request validation for an unlocked package should feature the tasks in this order

&nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp;&nbsp;![PR Pipeline](/images/PR Pipeline ScratchOrg.png)

1. Install the SFDX CLI
2. Validate the unlocked package for metadata coverage
3. &nbsp;Analyze force-app using PMD
4. Authenticate DevHub
5. Create a Scratch Org
6. Deploy source to the target scratch org
7. Trigger Apex Tests in ScratchOrg
8. Validate Apex Test Coverage&nbsp;

* Most of the tasks are very thin wrappers around the equivalent sfdx cli commands or the open-source sfpowerkit (SFDX CLI extension). Almost all parameters that are required during a CI run is exposed. If you feel that is not enough for the task at hand, one can quickly fall back to command line&nbsp; task just for the task.&nbsp;

* Though the tasks can all be utilized fully in build pipeline. It is recommended to utilize the Release Pipeline to deploy the artifact to make the full use of Azure Pipelines Capability.

#### Getting Started

Checkout sfpowerscripts documentation here on how to [Get Started](https://sfpowerscripts.com/gettingstarted/) with these tasks. The [repo](https://github.com/azlamsalam/sfpowerscripts/tree/release/SamplePipelines) also features sample pipelines that demonstrate the usage of pipelines.

#### What if there is an issue with the extension?

Please create an issue using the methods listed [here](https://sfpowerscripts.com/support/).