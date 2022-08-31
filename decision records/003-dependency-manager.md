# Dependency Manager 
•	Status: Accepted
•	Issue: #638

## Context and Problem Statement 
As the number of packages increases in large scale projects, with multiple dependencies, updating package versions and dependencies manually is time consuming and takes great care to update dependencies one by one. 

Other solutions encountered were local bash scripts as documented in both the issue https://github.com/dxatscale/sfpowerscripts/issues/638 raised and in the discussions has here: https://github.com/dxatscale/sfpowerscripts/discussions/468 

## Solution
The dependency manager should utilise the SemVer incrementation style https://semver.org/ and be of a similar method to the ‘lerna version’ command. It should prompt the user for the version either for individual packages or for all packages in the sfdx-project.json: (major, minor, patch, custom). 

Since salesforce does not necessarily follow the semver versioning, 
We will also not be supporting pre-release versioning at this stage. 

Steps to the command:
For each package in the sfdx-project.json the command will ask 
1. if the package version should be updated
2. If the package is a source/data package with a non-zero build number, does the build number need to be reset to 0 or stay as is 
3. if the package version has been updated, would the user like all packages with this dependency updates as well? 

The packageDirectories portion will then be updated with the input given and written to the sfdx-project.json in the root folder with the option to commit the file (but not push to the repo). 

## Decision 
A new command would be built with the above solution and will be added to ~~sfpowerscripts~~ in sfp-cli.
