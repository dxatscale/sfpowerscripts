# Solve for artifact duplication

* Status: Rejected  <!-- optional -->


## Context and Problem Statement

On some CICD platforms, where build numbers are not unique across the organisation, artifacts versions might be duplicated when creating release candidates for the first time and the build number starts from zero on a release pipeline. The outcome would be a mutation error on the artifact registry that prevents the artifact from being published.

This is a problem for source & data packages only. Unlocked package versions are handled by Salesforce.

## Options
1. **Use single pipeline for both develop and release streams**
    - Use a single pipeline for both the develop and release streams, so that the build numbers are sequential and do not overlap. This can be achieved by conditionally selecting pipeline definitions based on the branch that triggered the build.
2. **Bump major/minor/patch version of the packages on the release stream**
    - This would create a new version-space where the build numbers can be reused again
    - The package versions on the develop stream should be ahead of the release candidates
3. **Store package versions in Salesforce instead of using the pipeline build number**
    - Similar to unlocked package versions, the version number for source packages could be stored as a record on Salesforce and incremented whenever a new package version is created. In effect, there would be a universal reference for package versions, preventing
      duplicated version numbers.
    - Clients may be reluctant to store package versions in Dev Hub
4. **Add branch to package version number for uniqueness**
    - Add the branch to the package version, as build metadata, so that artifacts versions are unique to the branch e.g. major.minor.patch-buildNumber+<branch>
5. **Prevent publishing of new packages with lower build numbers**
    - sfpowerscripts:orchestrator:publish could feature a new functionality that checks the artifact repository whether a package with higher build number (of the same major.minor.patch) already exists. If it exists, it would prevent the package to be published
    - This would result in concurrency issues, as it prevents concurrent publish pipelines to publish artifacts.

## Decision

Due to various complexities, it is better to utilize #2, user's has to follow semantic version rather than sfpowerscripts doing any form of automation
