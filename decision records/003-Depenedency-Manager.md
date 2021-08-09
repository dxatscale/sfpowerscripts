# Dependency Manager 
•	Status: Proposed
•	Issue: #638

## Context and Problem Statement 
As the number of packages increases in large scale projects, with multiple dependencies, updating package versions and dependencies manually is time consuming and takes great care to update dependencies one by one. 

Other solutions encountered were local bash scripts as documented in both the issue https://github.com/Accenture/sfpowerscripts/issues/638 raised and in the discussions has here: https://github.com/Accenture/sfpowerscripts/discussions/468 

## Solution
The dependency manager should utilise the SemVer incrementation style https://semver.org/ and be of a similar method to the ‘lerna version’ command. It should prompt the user for the version either for individual packages or for all packages in the sfdx-project.json: (major, minor, patch, custom). 

Since salesforce does not necissarily follow the semver versioning, we will provide a summary to the bump. 
Eg. Option 1 bump Major - includes incompatible API changes
We will also not be supporting pre-release versioning at this stage. 

Steps to the command:
For each package in the sfdx-project.json the command will ask 
1. if the package version should be updated
2. if the package version has been updated, would the user like all packages with this dependency updates as well? 
3. Would the user like to update the dependencies of this package? (regardless of whether the package version was updated)

the packageDirectories portion will then be updated with the input given and written to the sfdx-project.json in the root folder. 

## Decision 
Development to commence on the solution and be included in the september release
