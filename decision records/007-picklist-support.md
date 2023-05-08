# Upgrade Picklist while deploying unlocked

* Status:  Decided
* Deciders: Azlam, Rody, Meng
* Date: 07/03/2023


## Context and Problem Statement

By design, Salesforce doesn't allow picklist values to be deployed during unlocked package upgrades. The current workaround is to either duplicate the picklist in a source package or apply the changes manually in the target org, which introduces an additional effort in terms of maintenance. This has also been reported as a known issue, see details https://issues.salesforce.com/issue/a028c00000qPzYUAA0/picklist-values-not-getting-deployed-during-unlocked-package-upgrades


## Solution

To resolve this, picklists and their values should be stored in a property of sfpPackage during the deployment of unlocked packages. As a post-deployment step, the stored picklists are retrieved from the target org, updated and pushed back to the org.

Option 1: Store the picklists prior to the deployment and redeploy the picklists after the deployment
- Easy to implement
- No API calls needed
- Could be slow due to the fact that the full picklist metadata needs to be redeployed
- Redundant step to redeploy properties other than ValueSet in picklists considering the fact that only ValueSet(s) in existing picklists are ignored during unlocked package upgrades


Option 2: Using API calls to update only the picklist values
- 2 API calls are needed for each picklist - one to retrieve the picklist field Id and the other to update the picklist value
- Logic could be relatively complex compared to option 1
- No need to store the picklists
- Faster


### Issues/Challenges with the solution:
- An option should be provided to allow user to turn off this feature
- Only existing picklists are covered as new picklists will always be deployed


Decision:

Option 2 has been selected for implementation
