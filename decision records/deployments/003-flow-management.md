# Flow Activation/Deactivation during deployment

- Status: Accepted
- Deciders: @azlam-abdulsalam, @vuha-acn, @zhebinliu @Rocko1204

## Context and Problem Statement

While installing a source/diff package, flows by default are deployed as 'Inactive' in the production org. One can deploy flow as 'Active' using the steps mentioned [here](https://help.salesforce.com/s/articleView?id=sf.flow_distribute_deploy_active.htm&language=en_US&type=5), however, this requires  the flow to meet test coverage requirement.

Also making a flow inactive, is convoluted, find the detailed article provided by [Gearset](https://gearset.com/blog/deactivate-flows-within-your-data-deployments/)

Currently, sfp is unable to validate test coverage requirements for a flow and unable to determine the impacted test class for a flow, Hence in projects utilizing sfp, flows has to be manually activated with source/diff packages causing environment discrepancy

## Decision

Adopt a process within sfp deployments to manage Salesforce Flows, focusing on the dynamic activation and deactivation of Flows as part of the deployment of a package. This process aims to ensure that Flows included in the deployment package are correctly set to their intended active or inactive states, reflecting the desired automation behavior in the target org.

The process will be auto enabled for source/diff packages and can be turned off by 'enableFlowActivation' as an additional package descriptor

The following workflow will be utilized by sfp to manage flows

### Process Summary
-  Deploy flow along with the intended status as provided by the developer in the package using the deployment mechanism of the package type
-  Prior to activation, identify all Flows included in the deployment package and determine their intended states (active or inactive) based on their configuration in the source control.
- Post-Deployment Adjustment: After successful deployment, adjust the activation state of each Flow based on its intended state identified by reading the metadata, This involves:
  - Activating Flows intended to be active but are currently inactive in the target org, using tooling api
  - Deactivating Flows intended to be inactive but are currently active in the target org.


## Consequences

- Improved Automation and Efficiency: Automating the process of activating and deactivating flows as part of the deployment package enhances the efficiency of deployments and reduces manual intervention, ensuring consistency across environments.
- Increased Complexity: Implementing this feature adds complexity to the sfp deployment process, requiring robust error handling and logging to manage the activation and deactivation of flows effectively.
