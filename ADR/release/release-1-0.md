# Introduce a notion of release into sfpowerscripts

* Status: Proposed  <!-- optional -->
* Deciders: Azlam, Alan <!-- optional -->
* Date: 23/03/21 <!-- optional -->

Technical Story: [Issue #452](https://github.com/Accenture/sfpowerscripts/issues/452) <!-- optional -->

## Context and Problem Statement

sfpowerscripts currently does not have a notion of 'release', which some CICD platforms like Azure pipelines support, allowing users to create release definitions, each with their own list of artifacts and task configurations. To achieve this across CICD platforms, the fetch, deploy and changelog generator commands all need to be combined to form a notion of release. Doing so will ensure that the notion of a release is available on all CICD platforms.


## Decision Drivers <!-- optional -->

* Ease-of-use <!-- numbers of drivers can vary -->
* Portability

## Considered Options

1. `orchestrator:release` command
2.  Shell script that orchestrates a release


## Decision Outcome

Chosen option: 1. `orchestrator:release` command

An orchestrator command is more intuitive to use than a shell script, and it's independent from OS.


## Pros and Cons of the Options <!-- optional -->

### `orchestrator:release` command

Utilises a release definition file (YAML format) and combines the steps in a release into a single SFDX command: fetching artifacts, installing dependencies, deployment and release changelog generation

Pros:
* Easy to use
* Compatible with any OS running Node

### Shell script that orchestrates a release

A re-usable shell script that that fetches artifacts, installs dependencies, deploys artifacts and generates a changelog.

Cons:
* Can't be packaged as a SFDX plugin
* Needs multiple scripts to support different OS
* Unintuitive to use, requires external documentation

## Links <!-- optional -->

* [Installing Package Dependencies]() <!-- example: Refined by [ADR-0005](0005-example.md) -->

<!-- markdownlint-disable-file MD013 -->
