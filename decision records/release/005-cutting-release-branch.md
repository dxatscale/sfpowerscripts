# Cutting release branch does not create a set of rc artifacts

* Status: Rejected  <!-- optional -->


## Context and Problem Statement

When cutting release branches, a set of rc artifacts are not automatically created. The user must disable `--diffcheck` to generate a set of rc artifacts, or manually publish the last dev artifacts to the rc feed, or update the rc tags in the case of single registry.
This process might be made simpler for the end-user, so that intervention is not required when cutting a release branch.

## Options
1. **CLI helper tools that automates release cutoff tasks**
    - Create a CLI tool that automates the tasks required when cutting a release branch: fetch last set of artifacts from develop feed and publish them to the rc feed, or updates the rc NPM tags to point to the last set of develop artifacts.
    - The CLI would have to authenticate to both the dev and rc feeds, which could be achieved using two separate .npmrc files
2. **Automatically create new rc artifacts for a new branch**
    - The build command will automatically create rc artifacts on a release cutoff, instead of showing that there is nothing to be built
    - This can be achieved by encoding the branch in the build metadata, so that tags can be further filtered by branch e.g. major.minor.patch-buildNumber+<branch>
3. **Disable `--diffcheck` when cutting new release branches**
    - Lowest effort
    - User is responsible for toggling `--diffcheck` when cutting release branches, so that a set of rc artifacts is created

## Decision

We move away from recommending multiple feeds, rather to use a single feed originating from the trunk, and release definitions will utilize the LATEST_TAG or LATEST_GIT_TAG to do a release from the from the release branch. Users are expected to follow semantic versioning to prevent conflicts. In the case of parallel development, it is still possible to use semantic versioning in a single artifact repository.
