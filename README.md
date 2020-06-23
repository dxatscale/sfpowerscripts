<p align="center">
  <img alt="sfpowerscripts" src="https://repository-images.githubusercontent.com/248449736/5d08c600-728e-11ea-8267-ae1aceebea60" width="480" height="400">
</p>

[![Netlify Status](https://api.netlify.com/api/v1/badges/b9ffe05d-af14-461e-bfc5-909ea0d7451f/deploy-status)](https://app.netlify.com/sites/sfpowerscripts/deploys) [![Build Status](https://dev.azure.com/dxatscale/sfpowerscripts/_apis/build/status/Release?branchName=develop)](https://dev.azure.com/dxatscale/sfpowerscripts/_build/latest?definitionId=40&branchName=develop) ![NPM Version](https://img.shields.io/npm/v/@dxatscale/sfpowerscripts)
### sfpowerscripts

sfpowerscripts is a wrapper around sfdx-cli and open source sfdx plugin [sfpowerkit]( 
https://github.com/Accenture/sfpowerkit) aimed at elimiinating wasted efforts in writing boiler plate code (often written using bash scripts) while setting up a  Continous Build system for Salesforce.

The project supports the following targets at the moment
- <b>Azure Pipelines</b> through a native extension. More details on the extension is available [here](https://github.com/Accenture/sfpowerscripts/tree/develop/packages/azpipelines)
- For other <b>Continous Build platforms</b>, through a sfdx-plugin. Details on the command and usage is available [here](https://www.npmjs.com/package/@dxatscale/sfpowerscripts)

The project intends to add native extension to other CI/CD platforms (which supports an extension based model) or provide sample pipelines to get started with minimal efforts.



#### Motivation

- Using sfdx-cli commands are relatively simple, however there is bit of  of code that would be required to parse the JSON output and set it to environment variables etc. for use within the next task.

- Additonal scripts are needed to integrate with a Continous Build system's native dashboards. For eg: In the case of Azure Pipelines, integrating with Test Reports etc

- Providing additional functionality that is either not supported by the sfdx-cli

- Ease of use, one should not be spending too much time building a pipeline.

#### History

sfpowerscripts initially began life in the form of a  Azure Pipelines Extension. available through the Visual Studio marketplace wrote by @azlam-abdulsalam as a personal project.

The project was then migrated to Accenture Open Source Program and a key component of Accenture DX@Scale initiative, a set of opinionated tool and practices for Enterprise Salesforce Development.The project is currently being expanded to support other Continous Build Platforms utilizing a sfdx-plugin. 

#### Maintainers

List of Maintainers are available in the [link](https://sfpowerscripts.com/maintainers/) 


#### Where do I reach for queries?

Please create an issue using the methods listed [here](https://sfpowerscripts.com/support/).
