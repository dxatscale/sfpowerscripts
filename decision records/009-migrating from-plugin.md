# Migration of sfpowerscripts from SFDX Plugin to Standalone CLI

- Status: Accepted
- Deciders: @azlam-abdulsalam @vuha-acn @zhebinliu  @rakr
- Date: 06/06/2023

## Context and Problem Statement

sfpowerscripts has been continuously adding features over the last four years, leading to an increase in the number of library dependencies. As an SFDX plugin,
this has created a bit of load on the sfdx cli startup times. However, the primary concern arises from Salesforce's decision to deprecate 'sfdx' cli in favor of 'sf', which entails a shift in input parameters and argument styles. This change necessitates sfpowerscripts to adapt quickly to these new patterns. In addition, issues have been noticed during plugin installation, particularly with libraries using node-gyp which is required for functionalites such as reconciling profiles

The deprecation of 'sfdx' by Salesforce also means that all documentation and usage practices have to be updated anyways.

## Decision

To address these issues and provide more flexibility in development and maintenance, it has been decided to migrate sfpowerscripts from being an SFDX plugin to a standalone CLI. This transition will enable it to function independently of the Salesforce CLI and change its features at its own pace. Users will be able to install sfpowerscripts directly from npm or use a Docker image.

## Consequences

This change will require users to adjust to a new installation and usage process. Documentation will need to be updated to reflect these changes. However, this migration will provide greater control over sfpowerscripts' development, allow for better handling of library dependencies, and bypass issues related to node-gyp during plugin installation. It also eliminates the necessity to rapidly adapt to new input patterns and argument styles introduced by Salesforce's 'sf' CLI. 

In the long term, the transition to a standalone CLI will provide a more robust and flexible tool for users, irrespective of changes to Salesforce's CLI offerings
