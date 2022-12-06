# Restrict Validation of packages validated by Release config

Status: Approved

Issue: #1133

## Context and Problem Statement

Use of orchestrator such as sfpowerscripts allows for many packages to be served from a single repository. Many users have reported the current number of packages served in a repo range upwards from 80+ packages in various domains handled by independent teams.  This can result in the following scenarios

- When a PR is validated, all the changed packages (based on what's installed in the org) is validated. So if a package X which is part of an independent domain and operated by team A (apparently merged and then resulted in a broken trunk), it can block all other teams to validate their PRs. While this is aligned with principles of Continuous Integration (CI), where a broken trunk needs to be fixed with utmost priority, this could result in a significant queue of PRs. This is apparently quite a common occurrence when the org is fully not refactored to use 'DX@Scale' principles

- Preparation of a full org with large number of packages can often be flaky returning partially created orgs. During validation of a PR, not only the changed packages will be validated, the missing packages will be validated resulting in significant time to receive feedback

- Same as above scenarios, a broken trunk can result in pools of scratch org with partially succeeded packages. Validation during this scenario can resulting in significant delays


## Decision

In order to improve the speed of feedback on PR, sfpowerscripts will provide additional validation modes 'ff-release-config' and 'thorough-release-config'. These two modes are analogous to existing modes fast feedback and thorough, however will be filtered by the provided release config.  The passed in release config will be used to generate the filter list and only the changed packages in the list (by comparing against what's installed in the org) will be utilized for validating and providing feedback to the devs regarding quality of their change.

Prepare command will also be modified to add support for creating pools of scratch orgs which are filtered by release config.
