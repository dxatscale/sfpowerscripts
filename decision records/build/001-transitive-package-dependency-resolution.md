# Transitive package dependency resolution
•	Status: Accepted
•	Issue: #855

## Context and Problem Statement
The Build command doesn't resolve transitive package dependencies and dependency order, there are several shortcomings with the current implementation:

1. Missing package dependencies from the dependent packages will cause the packages fail to be built
2. The dependency versions are not matched with the same version in the dependent packages
3. The transitive dependencies are redandunt in the sfdx-project.json, it makes the file hard to maintain, especially when the project is at scale and has multiple cross-package dependencies


## Solution

To address the above issues, there is an extra validation will be applied in `sfpowerscripts:orchestrator:build` command, This includes a resolver for the transitive dependency.
At the start of a build, the transitive package dependencies will be resolved in one go, leaving dependencies on packages that are part of the same build to be resolved dynamically, as they are created.
There is also a individual command `sfpowerscripts:dependency:expand` can be used to generate a resolved sfdx-project.json file for reviewing.


