# Add custom script support in pool prepare command before dependency installation and after package installation

• Status: Accepted

• Issue: #991

## Context and Problem Statement

Scratch org pool prepare command is designed to prepare a set of scratch orgs with all required dependencies installed (latest packages can also be installed depends on the pool config file), which boost the PR validation process in CI pipeline. However, some Salesforce issues occur during the automation process and lead into the following issues.

- Features are not enabled during the scracth org provision process

    Everytime when we need to prepare a scratch org pool, it's very likely there are some features will not be enabled in the scratch org, hence the future dependency installations or package deployments might fail due to the missing features. In some instances, the error occurs in the middle of the deployment and the process has already been running for few hours which makes the pool prepare as the pool will either failed to be created or partial succesful
  
## Decision

Provide capability user can execute custom scripts before package dependency installation and after package deployment. In order to give user more control of the process, below argurements will be passed into script for use in the custom logic

### User should consider the behavior of custom script in following scenarios:
#### The behaviour on succeedOnErrors
Based on the 4th script arguement listed above, user should decide the behaviour on whether the script needs to be executed or have different set of code to be executed depends on the deployment status.

#### The behaviour on pool definitions without request for deployment
The script should be able to read the "installAll" attribute from the config file, and build the logic about whether the script always neeed to be executed or it depends on the deployment configuration.

#### what happens when the script fails
The script should include error handling for all possible exit codes, unhandled error will lead to pipeline failure hence the pool will be deleted.