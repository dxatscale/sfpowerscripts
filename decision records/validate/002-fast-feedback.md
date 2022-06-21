# Provide faster feedback during validate

Status: Approved

Issue: #945

## Context and Problem Statement

Validate command in sfpowerscripts is effectively an automated check which validates an incoming change is ready to integrate with the trunk. Effectively a pre check before the CI job is triggered to build the packages. Validate shares the same functionality as used by the Build Command, and a package is marked to be built when the following changes are detected

- A change in package descriptor of a package

- A change in the contents of the package

Validate check for the following for each changed package (by comparing the commit id of the package installed in the scratch org vs incoming package)

- Deployability, whether a package as a whole is deployable in a scratch org along with other components

- Accuracy of Apex classes, by triggering apex test classes for each package

- Coverage Requirements, whether the coverage requirements are met for the type of package

- Optional Dependency and Impact Analysis

Validate also will deploy any changes to external package (packages which are not in the repo).

On analysis of of current DX@Scale projects, the above process on an average takes around 20 mins, with some runs running into multiple hours when the temporary org used for validation does't meet the below criteria

- Temporary org prepared for validation doesnt have all the packages in the repo installed

- Tests for some of the changed packages take a considerable time to complete, This is especially cumbersome for packages that are depenedent on managed packages like CPQ which utilizes a lot of queries and need to be triggered in [serial mode](https://github.dev/dxatscale/sfpowerscripts/blob/58351783f629840b4d78e35aa17eb084ef66e769/decision%20records/validate/001-automated-apex-testing-retry.md#L6)

- Fetching coverage of a test run is costly for packages with lot of test classes and there are multiple packages with test classes

- Reconciling large amount of profiles

As more and more developers across Salesforce projects are preferring a pull request workflow as offererd in the DX@Scale model, costly validation becomes a bottleneck in the process, even if the change is only for a single component and worse when the changed component doesn't haven any impact on the apex classes making apex tests not necessary.

sfpowerscripts should offer mechanisms which would provide feedback on a change to the developer as well as reviewer as fast as possible.

## Decision

sfpowerscripts will introduce a new mode 'fast feedback' (by introducing a new flag in validate command) with the aim to reduce the time spent on PR validation. In this particular mode, during validate, sfpowerscripts will primary focus only on the deployability of the changed component as opposed to any other checks as seen in the current validation. 

This means the following:

- Validate deployability of a changed package by only installing the changed components in a package

- Accuracy of apex classes by doing an impact analysis and selective tests -  Changed components are used to evaluate impacted apex classes, and utilizing these impacted apex classes to figure out required test classes

- Skip coverage calculation, as calculating coverage is no longer feasible

- Skip deployment of a package even if the descriptor is changed (This was based on feedback received, why trigger checks when the only change was version increments or adding a new dependency )

- Skip deployment of top level packages that do not have direct dependency on the package containing changed components.

The above changes will ensure the validate command is highly performant and provides faster feedback than the current mechanism. However, this mechanism is not perfect, hence the users of sfpowerscripts will be asked to implement an optional chaining of normal feedback mode which can be manually triggered if the user intends to compute coverage computation or want to validate scripts being added in the descriptor.

<img width="982" alt="image" src="https://user-images.githubusercontent.com/43767972/168079278-3324381f-555a-43ab-8172-ac0a5390a272.png">
