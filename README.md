[![DeepScan grade](https://deepscan.io/api/teams/10234/projects/12959/branches/208838/badge/grade.svg)](https://deepscan.io/dashboard#view=project&tid=10234&pid=12959&bid=208838)  [![Build Status](https://dev.azure.com/dxatscale/sfpowerscripts/_apis/build/status/Release?branchName=develop)](https://dev.azure.com/dxatscale/sfpowerscripts/_build/latest?definitionId=40&branchName=develop)   [![codecov](https://codecov.io/gh/Accenture/sfpowerscripts/branch/develop/graph/badge.svg?token=BOSH3G2PSU)](https://codecov.io/gh/Accenture/sfpowerscripts)  [![CodeFactor](https://www.codefactor.io/repository/github/accenture/sfpowerscripts/badge)](https://www.codefactor.io/repository/github/accenture/sfpowerscripts)

 [![npm (tag)](https://img.shields.io/npm/v/@dxatscale/sfpowerscripts/alpha)](https://www.npmjs.com/package/@dxatscale/sfpowerscripts/v/alpha)  [![npm (tag)](https://img.shields.io/npm/v/@dxatscale/sfpowerscripts/beta)](https://www.npmjs.com/package/@dxatscale/sfpowerscripts/v/beta)  [![npm](https://img.shields.io/npm/v/@dxatscale/sfpowerscripts)](https://www.npmjs.com/package/@dxatscale/sfpowerscripts)  [![Docker Image Version (latest semver)](https://img.shields.io/docker/v/dxatscale/sfpowerscripts)](https://hub.docker.com/r/dxatscale/sfpowerscripts)

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

[![npm](https://img.shields.io/npm/dw/@dxatscale/sfpowerscripts)](https://www.npmjs.com/package/@dxatscale/sfpowerscripts)  [![Docker Pulls](https://img.shields.io/docker/pulls/dxatscale/sfpowerscripts)](https://hub.docker.com/r/dxatscale/sfpowerscripts)

![](https://img.shields.io/badge/Compatible%20with%20sfdx--cli-7.96.1-green)

<p align="center">
  <img alt="sfpowerscripts" src="https://repository-images.githubusercontent.com/248449736/5d08c600-728e-11ea-8267-ae1aceebea60" width="480" height="400">
</p>


A build system for package based development in Salesforce , delivered as a sfdx plugin that can be implemented in any CI/CD system of choice.Read more about the plugin and details here - https://dxatscale.gitbook.io/sfpowerscripts/


#### Features

- Features an Orchestrator, which utilizes sfdx-project.json as the source of truth for driving the build system, ensuring very low maintenance on programs often dealing with multiple number of packages
- Builds packages in parallel by respecting dependencies
- Ability to selectively build changed packages in a mono repo
- Ability to deploy only packages that are changed in repo
- Pooling commands to prepare a pool of scratch org's with packages pre installed for optimized Pull/Merge Request validation
- Artifacts Driven, all create commands produce an artifact or operate on an artifact
- Integrate with any CI/CD system of choice
- All commands are enabled with statsD, for collecting metrics about your pipeline.

There are lot more features to explore. Read more at  https://dxatscale.gitbook.io/sfpowerscripts/features

The project is delivered as a <b>SFDX CLI Plugin</b> that can be deployed in any CI/CD system, The plugin is available [here](https://www.npmjs.com/package/@dxatscale/sfpowerscripts)


#### Motivation

- Need for artifact driven build system for package based development models especially on complex and large programs

- Providing additional functionality that is either not supported by the sfdx-cli, such as data packages or automatically understanding tests in a given package

- Ease of use, one should not be spending too much time scripting a pipeline.

#### Sample Pipelines

Sample pipelines demonstrating the usage of sfpowerscripts are available [here](https://github.com/dxatscale/easy-spaces-lwc)

#### Docker

Docker images for sfpowerscripts are available at [Docker Hub](https://hub.docker.com/r/dxatscale/sfpowerscripts).

The sfpowerscripts docker image has the following SFDX CLI plugins installed:

- [sfpowerscripts](https://github.com/Accenture/sfpowerscripts)
- [sfpowerkit](https://github.com/Accenture/sfpowerkit)
- [sfdmu](https://github.com/forcedotcom/SFDX-Data-Move-Utility)

We recommend using the sfpowerscripts docker image to avoid breakages in your CICD pipelines due to updates in sfpowerscripts or any of its dependencies such as the SFDX CLI.

#### Maintainers

List of Maintainers are available in the [link](https://dxatscale.gitbook.io/sfpowerscripts/maintainers)


#### Where do I reach for queries?

Please create an issue in the repo for bugs or utilize GitHub Discussions for other queries
