<p align="center">
  <img alt="sfp" src="https://repository-images.githubusercontent.com/248449736/448f93b4-9883-48da-a75c-330f242bbf8c" width="480" height="400">
</p>

![Version](https://img.shields.io/npm/v/@flxblio/sfp.svg)
[![GitHub stars](https://img.shields.io/github/stars/flxlblio/sfp)](https://gitHub.com/flxlblio/sfp/stargazers/)
[![GitHub contributors](https://img.shields.io/github/contributors/flxlblio/sfp.svg)](https://github.com/flxlblio/sfp/graphs/contributors/)
[![License](https://img.shields.io/badge/license-MIT-green)](https://github.com/flxlblio/sfp/blob/master/LICENSE)
[![PRs Welcome](https://img.shields.io/badge/PRs-welcome-brightgreen.svg?style=flat-square)](http://makeapullrequest.com)

[![DeepScan grade](https://deepscan.io/api/teams/10234/projects/12959/branches/208838/badge/grade.svg)](https://deepscan.io/dashboard#view=project&tid=10234&pid=12959&bid=208838)
[![FOSSA Status](https://app.fossa.com/api/projects/git%2Bgithub.com%2Fflxlblio%2Fsfp.svg?type=shield)](https://app.fossa.com/projects/git%2Bgithub.com%2Fflxlblio%2Fsfp?ref=badge_shield) [![CII Best Practices](https://bestpractices.coreinfrastructure.org/projects/5614/badge)](https://bestpractices.coreinfrastructure.org/projects/5614)

[![Join slack](https://i.imgur.com/FZZmA3g.png)](https://launchpass.com/flxlblio)

A build system for package based development in Salesforce, delivered as a node cli that can be implemented in any CI/CD system of choice.Read more about the cli and details here - https://docs.flxlbl.io

#### Features

- Features an Orchestrator, which utilizes sfdx-project.json as the source of truth for driving the build system, ensuring very low maintenance on programs often dealing with multiple number of packages
- Builds packages in parallel by respecting dependencies
- Ability to selectively build changed packages in a mono repo
- Ability to deploy only packages that are changed in repo
- Pooling commands to prepare a pool of scratch org's with packages pre installed for optimized Pull/Merge Request validation
- Artifacts Driven, all create commands produce an artifact or operate on an artifact
- Integrate with any CI/CD system of choice
- All commands are enabled with statsD, for collecting metrics about your pipeline.

There are lot more features to explore. Read more at https://docs.flxlblio.io

The project is delivered as a <b>CLI</b> that can be deployed in any CI/CD system, The module is available in [NPM](https://www.npmjs.com/package/@flxlblio/sfp) or can be
used by using the [docker image](https://github.com/flxlblio/sfp/pkgs/container/sfp)





#### Motivation

- Need for artifact driven build system for package based development models especially on complex and large programs

- Providing additional functionality that is either not supported by the sf cli, such as data packages or automatically understanding tests in a given package

- Ease of use, one should not be spending too much time scripting a pipeline.

#### CI/CD Reference Implementation

Getting started guides for popular CI/CD platforms along with reference pipelines are available [here](https://docs.flxlblio.io/implementing-your-ci-cd/github)

#### Installing sfp locally

sfp can be installed on your local device using npm

```
npm i -g @flxlblio/sfp
```


#### Docker

Docker images for sfp are available at [GitHub Container Registry](https://github.com/flxlblio/sfp/pkgs/container/sfp).

We recommend using the sfp docker image to avoid breakages in your CI/CD pipelines due to updates in sfp or any of its dependencies such as the SFDX CLI.

#### Build Instructions
To build sfp execute the following on the terminal:
```
npm i -g lerna #Install Lerna Globally
cd <sfp directory> # Navigate to the checked out directory
pnpm i
lerna run build
```

To run unit tests

```
lerna run test
```

To debug and test plugin

```
 cd packages/sfp-cli
 npm link
```

#### Maintainers

List of Maintainers are available in the [link](https://docs.flxlblio.io/about-us)


#### Where do I reach for queries?

Please create an issue in the repo for bugs or utilize GitHub Discussions for other queries. Join our [Slack Community](https://launchpass.com/flxlblio) as well.


## License
[![FOSSA Status](https://app.fossa.com/api/projects/git%2Bgithub.com%2Fflxlblio%2Fsfp.svg?type=large)](https://app.fossa.com/projects/git%2Bgithub.com%2Fflxlblio%2Fsfp?ref=badge_large)
