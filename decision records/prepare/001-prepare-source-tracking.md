# Implementation of source tracking on prepare command

* Status: Accepted  <!-- optional -->
* Deciders: Azlam, Alan
* Date: 23-03-2021


## Context and Problem Statement

This decision record is made necessary by the [changes](https://github.com/forcedotcom/cli/issues/1258) to source tracking implementation by the Salesforce CLI team, which have a downstream effect on sfpowerscripts as a consumer of its source tracking for preparing scratch org pools. The `sourcePathInfos.json` is being replaced by a git repository, which is used to keep track of changes to source files, and in order to maintain interoperability between the prepare command and the new source tracking, this change needs to be accommodated. In this decision record, we discuss different options for constructing the source tracking static resources (maxRevision.json & git repo), which are deployed to the scratch orgs created by the prepare command.

## Options
1. **Deploy source code from the commit ID of the leading artifact**

    Instead of deploying source code from each artifact, determine the latest commit ID from the artifacts, and then push the source code from the repository at the latest commit ID.

    Pros:
    - Since the push is occurring in the project directory, where all the packages exist, there is no requirement for merging the source tracking information between artifacts. The source tracking files can be deployed to the scratch org as a static resource, without modification.

    Cons:
    - If publishing artifacts is not dependent on a successful build stage, the latest commit ID taken from artifacts may contain undeployable changes.
2. **Re-compose project directory from artifacts**

    In this option, the project directory is recomposed using the package directory and sfdx-project.json from each artifact. Like the previous option, source tracking information does not need to be merged, as the push is occurring from the project directory. The difference is that in this option, we can be certain that only source code from the latest validated artifacts are deployed.

    Cons:
    - Difficult to merge package directories and sfdx-project.json (order of packages) from different commits
3. **Merge the objects from different git repositories**

    Similar to the current implementation where `sourcePathInfos.json` from different artifacts are merged into one, this option involves merging the objects from git repositories across different artifacts into a single repository.

    Cons:
    - Difficult to merge git objects, need to recreate and manipulate the commit and tree objects

4. **Create local source tracking using sfpowerscripts artifacts in the scratch org**

    Instead of storing local source tracking as a static resource, re-create it when fetching a scratch org from a pool, using the @salesforce/source-tracking library. Checkout the commit from which each sfpowerscripts artifact was created, and update the local source tracking using the package directory.

    Pros:
    - No static resource required

    Cons:
    - Increased computation when fetching a scratch org
5. **Store object hashes as static resource**
    Store the hash ID of tree and blob objects in a static resource, which can be used when fetching a scratch org to recreate the local source tracking by creating a commit from the root tree object.

    Pros:
    - Static resource is a text file consisting of hash ID's, and thus has an inexpensive storage size

## Decision

Option 4 has been chosen for implementation. Out of all the options, it is the only one that is technically feasible and is not hindered by the size limitation of static resources.

Options 1-3 are not feasible because of the size of the git repository, which is too large (6 orders of magnitude) to store as a static resource.

Option 5 is blocked by the difference between the local source tracking repo and the project repo. The tree objects in the project repo may have additional files such as README which makes it impossible to correlate hash ID's between repositories.
