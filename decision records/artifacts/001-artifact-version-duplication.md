# Solve for artifact duplication

* Status: Proposed  <!-- optional -->


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

## Decision
