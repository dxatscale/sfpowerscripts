# Overview

An opinionated Salesforce build system  as a sfdx plugin that can be implemented in any CI/CD system of choice

## **Features**

* Features an Orchestrator, which utilizes sfdx-project.json as the source of truth for driving the build system, ensuring very low maintenance on programs often dealing with multiple number of packages
* Builds packages in parallel by respecting dependencies
* Ability to selectively build changed packages in a mono repo
* Ability to deploy only packages that are changed in repo
* Pooling commands to prepare a pool of scratch org's with packages pre installed for optimized Pull/Merge Request validation
* Artifacts Driven, all create commands produce an artifact or operate on an artifact
* Integrate with any CI/CD system of choice
* All commands are enabled with statsD, for collecting metrics about your pipeline

{% embed url="https://www.youtube.com/watch?v=De9euEin67A" %}



## History

sfpowerscripts initially began life in the form of an Azure Pipelines Extension available through the Visual Studio marketplace wrote by Azlam Abdulsalam as a personal project.

The project was then migrated to Accenture Open Source Program and a key component of Accenture DX@Scale initiative, a set of opinionated tool and practices for Enterprise Salesforce Development. The project is currently being expanded to support other Continuous Build Platforms utilizing a sfdx-plugin.

## Maintainers

A list of people maintaining sfpowerscripts and these pages is available [here](maintainers.md)

## How do I submit a query to sfpowerscripts?

Please create an issue using the methods listed [here](contributing-to-sfpowerscripts.md).

