# Implementation of source tracking on prepare command

* Status: investigating  <!-- optional -->


## Context and Problem Statement

This decision record is made necessary by the [changes](https://github.com/forcedotcom/cli/issues/1258) to source tracking implementation by the Salesforce CLI team, which have a downstream effect on sfpowerscripts as a consumer of its source tracking for preparing scratch org pools. The `sourcePathInfos.json` is being replaced by a git repository, which is used to keep track of changes to source files, and in order to maintain interoperability between the prepare command and the new source tracking, this change needs to be accommodated. In this decision record, we discuss different options for constructing the source tracking static resources (maxRevision.json & git repo), which are deployed to the scratch orgs created by the prepare command.

## Options
1. **Deploying source code from the commit ID of the leading artifact**

    Instead of deploying source code from each artifact, determine the latest commit ID from the artifacts, and then push the source code from the repository at the latest commit ID.

    Pros:
    - Since the push is occurring in the project directory, where all the packages exist, there is no requirement for merging the source tracking information between artifacts. The source tracking files can be deployed to the scratch org as a static resource, without modification.

    Cons:
    - If publishing artifacts is not dependent on a successful build stage, the latest commit ID taken from artifacts may contain undeployable changes.
2. **Re-composing project directory from artifacts**

    In this option, the project directory is recomposed using the package directory and sfdx-project.json from each artifact. Like the previous option, source tracking information does not need to be merged, as the push is occurring from the project directory. The difference is that in this option, we can be certain that only source code from the latest validated artifacts are deployed.
3. **Merging the objects from different git repositories??**

    Similar to the current implementation where `sourcePathInfos.json` from different artifacts are merged into one, this option involves merging the objects from git repositories across different artifacts into a single repository.

## Decision
