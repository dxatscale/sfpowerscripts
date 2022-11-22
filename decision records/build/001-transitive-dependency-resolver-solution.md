# Transitive dependency resolver resolution
•	Status: Approved
•	Issue: #855

## Context and Problem Statement
sfdx-project.json is the manifest which determines the packages in a particular project, dependencies of each packages and deployment order. There are some potential risks with the large sfdx-project.json.

1. As projects grow, the complexity of this manifest grows (3K+ lines in some projects) making it incomprehensible
1. Dependency change can be a time consuming task
1. Missing dependency is hard to be identified at early stage

## Solution

To address those issues, a dependency resolver is designed to auto validate the package dependencies in sequence, the transtive dependencies from its dependent packages can be copied to each packages. All missing dependencies can be fixed before the actual packaging process and also user can keep the only the extra dependencies to keep the sfdx-project.json tidy and manageable.
