# Ability to rollback a failed release

* Status: Proposed  <!-- optional -->


Issue: [Issue #478](https://github.com/dxatscale/sfpowerscripts/issues/478) <!-- optional -->

## Context and Problem Statement

When one releases a set of packages into an environment, there could be situations where one of the package fails and resulting in an incorrect org in
terms of functionality.
For eg: A release which consists of packages A,B and C failed during the installation of C, has new versions of A and B, introducing new functionality
to the org, where as its not accurate without package 'C'.  

Though number of these instances are pretty low in higher environments, as a particular release would be tested a number of times in multiple environments in lower environments. There are still instances where packages fail to install mostly due to a missing manual step. This results in a potential downtime till the team addresses the failure by a roll-forward.

It would be ideal in this scenario to have a rollback option, which basically realigns the org back to the versions of the packages that were available in the org before the release was intiated.

## Decision 

### Release command to support a rollback function

Release command will support an optional rollback function enabled through `rollback:true` parameter in the release defintion. Once this functionality is activated, release command will keep track of existing packages in the org (in memory) before deploying packages as part of the current release. In case of any failures, release command will fetch the old artifacts from the artifact repository and proceed to installing these packages into the org.

Unlocked packages have its own lifecycle and Salesforce would maintain deprecation and removal of unused components arising from a rollback. However for source packages, it needs to have a destructive manifest to remove the items already deployed. This functionality only attemps to install an earlier set of packages, and doesnt attempt to destroy any deployed components, especially in the case of source packages. However we could let the users know what are the components left dangling by providing a table of metadata components that will not be removed.

## Conseuqences <!-- optional --> 

This functionality will support ability to rollback an org to an earlier release. However not every rollbacks in Salesforce is going to be successfull, as the platform doesn't inherently support the notion of a rollback for many components and its tightly based on dependencies of a particular component. This rollback functionality could also leave the org with items that are not removed



<!-- markdownlint-disable-file MD013 -->
