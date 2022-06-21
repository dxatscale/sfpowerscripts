# Introduce a notion of release into sfpowerscripts

* Status: Accepted  <!-- optional -->
* Deciders: Azlam, Alan <!-- optional -->
* Date: 23/03/21 <!-- optional -->

Issue: [Issue #452](https://github.com/dxatscale/sfpowerscripts/issues/452) <!-- optional -->

## Context and Problem Statement

sfpowerscripts currently does not have a notion of 'release', which some CICD platforms like Azure pipelines support, allowing users to create release definitions, each with their own list of artifacts and task configurations. To achieve this across CICD platforms, the fetch, deploy and changelog generator commands all need to be combined to form a notion of release. Doing so will ensure that the notion of a release is available on all CICD platforms.


## Implementation Options

### 1. `orchestrator:release` command

Utilises a release definition file (YAML format) and combines the steps in a release into a single SFDX command: fetching artifacts, installing dependencies, deployment and release changelog generation.

This command utilizes a YAML based release defintion as opposed to sfdx-project.json which is used by the orchestrator elsewhere. The benefit of using a seperate defintion is to keep release and build defintions seperated, as one could use for selective deployments.

Pros:
* Easy to use
* Compatible with any OS running Node

Cons:
* Loses flexibility, one can only use the functionality provided by the release command.


### 2.  Shell script that orchestrates a release

A re-usable shell script that that fetches artifacts, installs dependencies, deploys artifacts and generates a changelog.

Pros:
* Flexibility, one can interleave custom scripts before any of the orchestrator calls

Cons:
* Can't be packaged as a SFDX plugin
* Needs multiple scripts to support different OS
* Unintuitive to use, requires external documentation


## Decision 

Chosen option: 1. `orchestrator:release` command

An orchestrator command is more intuitive to use than a shell script, and it's independent from OS. Though this is bit inflexible and tied to the options being provided by the sfpowerscripts, it fastens adoption of the tooling. Users who have requirements that are not satisfied by the release commands can switch to a shell script and orchestrate it.


## Links <!-- optional -->

* [Installing Package Dependencies](https://github.com/dxatscale/sfpowerscripts/blob/develop/ADR/release/release-1-1.md) <!-- example: Refined by [ADR-0005](0005-example.md) -->

<!-- markdownlint-disable-file MD013 -->
