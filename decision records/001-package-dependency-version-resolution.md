# Package dependency version resolution
•	Status: Accepted
•	Issue: #496

## Context and Problem Statement
The Build command resolves package dependency versions, using `sfpowerkit:package:dependencies:list`, but there are several shortcomings with the current implementation:

1. Executing sfpowerkit CLI in a node process
1. The package versions are not filtered to the branch
1. Dependencies on packages that are part of the same build are not guaranteed to pick up the version created in the build; it just fetches the LATEST version
1. The resolved dependencies are not reflected in the artifact metadata or sfdx-project.json

## Solution

To address the first issue, the sfpowerkit command will be replaced with a direct API call and implementation within sfpowerscripts. This includes a fetcher for the Package2Version sObject.
At the start of a build, the package dependencies will be resolved in one go, leaving dependencies on packages that are part of the same build to be resolved dynamically, as they are created.
For dependencies on packages that are part of the same repo, the validated package versions are filtered to the current branch using git tags created by Publish.

![image](https://user-images.githubusercontent.com/43767972/173757853-ee26195e-0a5c-4adb-9dac-826defb0b02d.png)

