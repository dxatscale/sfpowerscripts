# Individual Validation Mode

Status: Approved

Issue: #1133

## Context and Problem Statement

sfpowerscripts is used as an orchestrator for modules in mono repositories. These mono repositories come in different forms and sizes.  Consider a mono repo which stores modules (packages) that are fairly independent of each other, like a repository that is comprised of technical frameworks. Using the current approach of PR validation, a significant amount of time is wasted, when a changed package is validated.  The command undertakes validation of all the packages above the changed package and then proceeds to validate the packages changed below the package as specified in the installation order described by 'sfdx-project.json' (non-pooled validation scenario). Though this could be sped up by using a pooled scratch org in this repo, maintaining a pool for such repos are compute and ops intensive for both cloud and self-hosted runners. Oftentimes these technical framework modules/packages support repos which seldom changes and pools are wasteful.

sfpowerscripts should provide options to only validate the changed package(s) without validating any other packages as specified in the project config.

## Decision

sfpowerscripts will add a new validation mode 'individual' to the list of validation modes (in addition to thorough and fast feedback). In this mode, the behavior of validation will be the following

- Ignore packages that are installed in the scratch org (basically eliminate the requirement of using a pooled org)
- Compute changed packages by observing the diff of Pull/Merge Request
- Validate each of the changed packages (install any dependencies) using thorough mode 
