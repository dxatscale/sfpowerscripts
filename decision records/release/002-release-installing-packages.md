# Install package dependencies as part of release

* Status: Accepted<!-- optional -->
* Deciders: Azlam, Alan <!-- optional -->
* Date: 23/03/21 <!-- optional -->

Issue: [Issue #452](https://github.com/Accenture/sfpowerscripts/issues/452) <!-- optional -->

## Context and Problem Statement

As part of a release, we need to install package dependencies. There are two different ways we could represent the package dependencies to be installed, each with their own merits.

## Implementation Options

### 1. Re-use dependencies defined in latest package manifest

 Requires the latest package manifest to be pruned of any packages that do not have an artifact, including any references to those packages as a dependency.

Pros:
* Least amount of effort required from the user, since package dependencies are already defined in the package manifest

Cons:
* Users may inadvertently install package dependencies that are owned by another group, if they overlook it in the package manifest <!-- numbers of pros and 

### 2. Duplicate dependencies in the release definition

Specify the 04t Id's of dependencies in the release definition

Pros:
* Explicitly defined dependencies prevents users from unintentionally installing package dependencies
* Package dependencies can be traced in the release definition

Cons:
* Users have to manually enter the 04t Id's of package dependencies into the release definition
* Chance of human error when inputting 04t Id's


## Decisions

Chosen option: 2. Duplicate dependencies in the release definition

Although it requires more input from the user, re-defining dependencies within the release definition is more reliable, as you have precise control over what dependencies are being installed. It also allows package dependencies to be tracked within the release definition file.

<!-- markdownlint-disable-file MD013 -->
