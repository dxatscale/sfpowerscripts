# Provide a way to identify packages when using a  npm repository tied to repository

* Status: Rejected  <!-- optional -->


## Context and Problem Statement

sfpowerscripts users typically utilize a [scaled trunk based branching model] (https://trunkbaseddevelopment.com/#scaled-trunk-based-development). In this model, packages would be built from both develop/master/main branches and then during the hardening phase from release branches. When using package registry such as Github Package Manager or Gitlab Package Manager which follow the concept of a package repository tied into the source code repository. These packages get intermingled and there is no easy mechanism to identify where the packages originated from. This becomes a prolem if the user wants to rollback to an older version of the package, the  current solution is to identify the package  manually by figuring the last released packages by checking in at the release deployment logs.

## Options
1. **Utilize two or more package feeds in  exclusive package registry**
	  -  Simple approach, rather than using a single package repository, utilize two package registry (feeds) one for the normal development  and another for release candidates and utilize bash script along with different .npmrc file to switch feeds and then users could locate the package based on the branches in the correct feed.
	  - This apporach wont scale, if the users deviates from scaled trunk based model and is still cumbersome to maintain as packages are stored elsewhere (it doesnt work with Github/Gitlab as a fork of the source code repository has to be created). This works exclusively only for dedicated package registry such as MyGet, Azure Artifacts or JFrog Artifactory where there is a concept for feeds.
2. **Use release identifier in  scope to distinguish package origins based on covention/user input**
	 -   In this approach, sfpowerscripts will enforce certain conventions (with an option to override). For eg: any package that is to be created from master/main/develop will have a scope name appended with _dev and any packages created from release branches will have the name _rc appended to the scope name.
	  - Prepare, Publish, Release and Fetch commands will utilize the branch to figure which packages to be utilized by fetching the artifacts from the correct scope
	  - This approach while works in dedicated package registry, is not compatible with Github Packages or  probably Gitlab as well, as both enforces scope to match the repository name.
3. **Use a release identifer in package names to distinguish package origins based on covention/user input**
     - It follows the same approach as option 2, however in this case package names will be appended with _dev (for the packages built from the trunk) and _rc(for the packages built release branches)
     - This provides for broader support for variety of package registry, however with the downside being a registry getting polluted with similar set of packages
     - Users could search the package registry to figure out the packages belonging to the correct branches
4. **Use a release identifer in git  tags to encode branching information**
    - It follows the same approach as option 2 or 3, however in this case git tags will be appended with _dev (for the packages built from the trunk) and _rc(for the packages built release branches)
    - Users could filter the tags by using wildcard to understand the last known packages
    - This works well with LATEST_GIT_TAG already implemented by the fetch command, as it currently filters to the package generated only by the branch.
    - Tags could be deleted hampering the ability to use releases
    - There will be traceability impact as tag naming doesnt match with package names in artifactory.
5. **Encode branch in package version number**
    - Encode the source branch in package version build-metadata e.g. major.minor.patch-buildNumber+<branch>
    - As a consequence, tags and artifact versions would also carry the branch information, allowing users to determine which stream artifacts versions belong to

## Decision
All the above solutions make it complicated and not necessary, as  changelog has more accurate details. It is better to use changelog to identify the packages
