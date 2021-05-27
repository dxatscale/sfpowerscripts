# Process for creating parallel development streams

* Status: Rejected  <!-- optional -->


## Context and Problem Statement

When creating a parallel development streams (e.g. release), there are a list of manual steps that must be performed:

- package versions may need to be updated so that packages between streams do not share the same version-space
- a new artifact feed or npm tags need to be created
- a set of artifacts needs to be created for the new development stream

## Options
1. **CLI helper tool for creating parallel dev streams**
    - Create a CLI tool that automates the tasks required when creating parallel development streams:
        - fetch last set of artifacts from source feed and publish them to the target feed; or
        - create NPM tags that point to the latest artifact versions from parent stream
        - increments package versions in the parent stream
        - create a new git branch
2. **Document the process**
    - Document the process for creating parallel development streams in Gitbook

## Decision

All this issues arised from the fact that with the assumption of using multiple feeds. As we are moving to ask users to utilize a single feed/artifact repository and how it is in most platforms like GitHub or GitLab, there is no specific need for a helper tool. Users should be versioning their artifacts using semantic version when dealing with multiple development streams
