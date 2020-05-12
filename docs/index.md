---
title: Overview
---

SFPowerscripts is an open source and free Azure Pipelines Extension that converts Azure Pipelines into a CI/CD platform for Salesforce. The extension features the following tasks. Install the plugin from [Visual Studio Marketplace](https://marketplace.visualstudio.com/items?itemName=AzlamSalam.sfpowerscripts) and read the documentation on how to configure a highly customizable Salesforce CI/CD Pipeline.

Please note this extension only works with the newer source format based repositories only and  works with both Hosted Linux and Windows Agents

#### Common/Utility Tasks

* Install SFDX CLI along with SFPowerkit Plugin
* Authenticate an Org using JWT or Username/Password/Security Token
* Validate a Unlocked package for metadata coverage
* Install all package dependencies of an unlocked package
* Run apex code analysis using PMD

#### Deployment Related Tasks

* Checkout a source based artifact from Git using PAT
* Deploy a source format based repo to an org (scratch org/sandbox/prod)
* Deploy an unlocked package to an org
* Deploy destructive manifest to an org

#### Packaging Related Tasks

* Increment Project Version Number similar to npm version patch, which can be utilized before an unlocked / source based packaging
* Create an unlocked package
* Create a build artifact for unlocked/source based packaging, which can be utilized in Release Pipelines

#### Testing / Code Quality Related Tasks

* Trigger Apex Test
* Validate Apex Test Coverge of an org
* Validate Code Coverage of a second generation package

#### How does it work?

* The extension is designed with tasks which are granular, which means all the above tasks have to be orchestrated in a valid order required to reach the required objective. This allows one to utilise other commands or extensions between the tasks and be highly effective rather than getting tied to a single task. This ensures maximum flexibility while building the pipeline.

For eg: a Pull Request validation for an unlocked package should feature the tasks in this order

![PR Pipeline](/images/PR Pipeline ScratchOrg.png)

1. Install the SFDX CLI
2. Validate the unlocked package for metadata coverage
3. Authenticate DevHub
4. Create a Scratch Org
5. Install Package Dependencies in the target scratch org
6. Deploy source to the target scratch org
7. Delete the scratch org ( optional :  Utilize post action on create scratch org task )

* Most of the tasks are very thin wrappers around the equivalent sfdx cli commands or the open-source sfpowerkit (SFDX CLI extension). Almost all parameters that are required during a CI run is exposed. If you feel that is not enough for the task at hand, one can quickly fall back to command line parameterized just for the taskMost of the tasks are very thin wrappers aroud the equivalent sfdx cli commands or the open source sfpowerkit (SFDX CLI extension). Almost all parameters that are requred during a CI run is exposed. If you feel that is not enough for the task at hand, one can quickly fall back to command line parameterized just for the task

* Though the tasks can all be utilized fully in build pipeline. It is recommended to utilize the Release Pipeline to deploy the artifact to make the full use of Azure Pipelines Capability.

#### Getting Started

Checkout SFPowerscripts documentation here on how to [Get Started](https://sfpowerscripts.com/gettingstarted/) with these tasks. The [repo](https://github.com/azlamsalam/sfpowerscripts/tree/release/SamplePipelines) also features sample pipelines that demonstrate the usage of pipelines.

#### What if there is an issue with the extension?

Please create an issue using the methods listed [here](https://sfpowerscripts.com/support/).
