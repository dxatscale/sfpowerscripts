# Add custom script support in pool prepare command before dependency installation and after package installation

• Status: Proposed

• Issue: #991

## Context and Problem Statement

Scratch org pool prepare command is designed to prepare a set of scratch orgs with all required dependencies installed (latest packages can also be installed depends on the pool config file), which boost the PR validation process in CI pipeline. However, some Salesforce issues occur during the automation process and lead into the following issues.

- Features are not enabled during the scracth org provision process

    Everytime when we need to prepare a scratch org pool, it's very likely there are some features will not be enabled in the scratch org, hence the future dependency installations or package deployments might fail due to the missing features. In some instances, the error occurs in the middle of the deployment and the process has already been running for few hours which makes the pool prepare as the pool will either failed to be created or partial succesful. Some known issues with scratch org provisoning are listed below.

      1. Account Contact Relation
      2. Activity setting
  

## Decision

Provide capability user can execute custom scripts before package dependency installation and after package deployment. In order to give user more control of the process, below argurements will be passed into script for use in the custom logic.
    1. package name (not applicable in prepare commnad)
    2. target org username
    3. devhub username
    4. installation/deployment status

User should control the behavior of custom script in following scenarios and handle all possible exit codes:
    1. whats the behaviour on succeedOnErrors
    2. whats the behaviour on pool definitions without request for deploment
    3. what happens when the script fails