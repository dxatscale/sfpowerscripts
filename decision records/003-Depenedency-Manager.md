# Dependency Manager 
•	Status: Proposed
•	Issue: #638

## Context and Problem Statement 
As the number of packages increases in large scale projects, with multiple dependencies, updating package versions and dependencies manually is time consuming and takes great care to update dependencies one by one. 

## Solution
The dependency manager should utilise the SemVer incrementation style https://semver.org/ and be of a similar method to the ‘lerna version’ command. It should prompt the user for the version: (major, minor, patch, custom) 

It will prompt the user for each package version, the command will then update all dependencies found for the package. 

## Decision 
Development to commence on the solution and be included in the september release
