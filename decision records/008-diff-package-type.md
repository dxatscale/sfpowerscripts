# Diff as a package type

* Status:  Decided
* Deciders: Azlam, Vu
* Date: 30/05/2023

## Context and Problem Statement

sfpowerscripts is a build and deployment orchestrator designed for modular Salesforce development. It allows each module of a project to be deployed as a complete unit, whether it's unlocked, source, or data packages. However, transitioning an organization to the DX@Scale model often requires extensive efforts to modularize a Salesforce org into multiple distinct modules. This process can be particularly challenging for medium to large organizations, as it involves a significant reorganization of their existing systems into individual domains and modules.

To facilitate this transition, many organizations prefer a phased approach over a "big bang" approach. This entails allowing packages to coexist with unpackaged sections of the project as the organization gradually transitions to the modular structure. Therefore, there is a need for sfpowerscripts to provide a mechanism to accommodate this approach by allowing the deployment of the unpackaged content along with other packaged modules.

## Considered Options

The primary solution considered is the introduction of a new package type in sfpowerscripts, referred to as a "Diff" package.

## Solution Description

A Diff package is a transition package that encompasses the changes (differences) made in the unpackaged metadata from the previous deployment, thus only deploying the delta. This package is designed to help organizations that are transitioning from a monolithic structure to a modular DX@Scale model.

### Potential Issues/Challenges:

While the Diff package solution offers a way to accommodate a phased transition to the DX@Scale model, it also presents certain challenges:

1. **Baseline Management**: Determining and maintaining the baseline for the unpackaged metadata can be complex. The system needs to accurately track the changes and keep the baseline updated after every successful deployment.
2. **Change Tracking**: The system should effectively track and manage the changes (additions, modifications, deletions) that occur in the unpackaged metadata.
3. **Package Dependency**: The Diff package may have dependencies on other packages, which needs to be managed effectively.
4. **Conflict Resolution**: There could be potential conflicts between the changes in the Diff package and the existing packages. The system should have an effective mechanism to detect and resolve such conflicts.
5. **Rollback Mechanism**: In case of deployment failure, a mechanism should be in place to roll back changes or to update the baseline to the previous stable state.

## Decision

sfpowerscripts will implement the Diff package solution with the following measures to address the above challenges:

1. **Baseline Management**: Each Diff package will be baselined against the last successfully deployed commit ID in the DevHub (production). This baseline will serve as a point of reference for tracking changes made in the unpackaged metadata. This mechanism ensures pipeline consistency until the package is successfully deployed in production.

2. **Initial Record**: An initial record in the sfpowerscripts artifact will need to be created with a baseline commit ID. This record serves as the starting point for tracking differences in subsequent changes. Upon deploying to prodution the baseline gets updated

3. **Package Dependency Management**: While it is not recommended to create a package that depends on the components of the Diff package, there can be source packages that include components like profiles and layouts exist after a diff package. The behavior of these source packages will remain the same as existing packages, with dependency validation being performed at runtime.

4. **Restrictions on Diff Packages**: The usage of Diff packages should be restricted to certain scenarios. Specifically, Diff packages should not be used in scratch org pools or with the 'validate' command. Instead, they should be applied only in 'validateAgainstOrg' scenarios where the packages are validated against a specific target organization.

5. **Validation in Scratch Orgs**: The other packages in the repo (sucessfully refactored) can be validated in scratch orgs using a scratch org pool and the 'releaseConfig' feature. In these scenarios, the Diff package is ignored. This allows the other packages to be validated independently, ensuring their quality before deployment.

This approach will allow organizations to smoothly transition from a monolithic structure to a modular DX@Scale model, by deploying unpackaged sections of the project alongside packaged modules in a controlled manner.
