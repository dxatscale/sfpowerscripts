[![DeepScan grade](https://deepscan.io/api/teams/10234/projects/12959/branches/208838/badge/grade.svg)](https://deepscan.io/dashboard#view=project&tid=10234&pid=12959&bid=208838) [![Build Status](https://dev.azure.com/dxatscale/sfpowerscripts/_apis/build/status/Release?branchName=develop)](https://dev.azure.com/dxatscale/sfpowerscripts/_build/latest?definitionId=40&branchName=develop) ![npm](https://img.shields.io/npm/v/@dxatscale/sfpowerscripts)![NPM](https://img.shields.io/npm/l/@dxatscale/sfpowerscripts) ![Visual Studio Marketplace Installs - Azure DevOps Extension](https://img.shields.io/visual-studio-marketplace/azure-devops/installs/total/AzlamSalam.sfpowerscripts?label=visualstudio%20marketplace%20installations)

<p align="center">
  <img alt="sfpowerscripts" src="https://repository-images.githubusercontent.com/248449736/5d08c600-728e-11ea-8267-ae1aceebea60" width="480" height="400">
</p>



sfpowerscripts is a lightweight orchestrator built on top of sfdx-cli and open source sfdx plugin [sfpowerkit]( 
https://github.com/Accenture/sfpowerkit) aimed at elimiinating wasted efforts in writing boiler plate code (often written using bash scripts) while setting up a  Continous Build system for Salesforce.

The project supports the following targets at the moment
- <b>Azure Pipelines</b> through a native extension. More details on the extension is available [here](https://github.com/Accenture/sfpowerscripts/tree/develop/packages/azpipelines)
- For other <b>Continous Build platforms</b>, through a sfdx-plugin. Details on the command and usage is available [here](https://www.npmjs.com/package/@dxatscale/sfpowerscripts)

The project intends to add native extension to other CI/CD platforms (which supports an extension based model) or provide sample pipelines to get started with minimal efforts.



#### Motivation

- Using sfdx-cli commands are relatively simple, however additional scripts are required to parse the JSON output, set it to environment variables etc

- Additonal scripts are needed to integrate with a Continous Build system's native dashboards or features. For eg: In the case of Azure Pipelines, integrating with Test Reports etc

- Providing additional functionality that is either not supported by the sfdx-cli, such as building a package only if its changed or skip installation if its.already installed in th org

- Ease of use, one should not be spending too much time building a pipeline.

#### History

sfpowerscripts initially began life in the form of a  Azure Pipelines Extension. available through the Visual Studio marketplace wrote by @azlam-abdulsalam as a personal project.

The project was then migrated to Accenture Open Source Program and a key component of Accenture DX@Scale initiative, a set of opinionated tool and practices for Enterprise Salesforce Development.The project is currently being expanded to support other Continous Build Platforms utilizing a sfdx-plugin. 

#### Maintainers

List of Maintainers are available in the [link](https://sfpowerscripts.com/maintainers/) 


#### Where do I reach for queries?

Please create an issue using the methods listed [here](https://sfpowerscripts.com/support/).
