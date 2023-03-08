# Picklist Support

* Status: New
* Deciders:
* Date: 07/03/2023


## Context and Problem Statement

By design, Salesforce doesn't allow picklist values to be deployed during unlocked package upgrades. The current workaround is to either duplicate the picklist in a source package or apply the changes manually in the target org, which introduces an additional effort in terms of maintainance. This has also been reported as a known issue, see details https://issues.salesforce.com/issue/a028c00000qPzYUAA0/picklist-values-not-getting-deployed-during-unlocked-package-upgrades


## Solution

To resolve this, picklists and their values should be stored in a property of sfpPackage during the deployment of unlocked packages. As a post deployment step, the stored picklists are retrieved from the target org, updated and pushed back to the org.


### Issues/Challenges with the solution:
- An option should be provided to allow user to turn off this feature
- This solution only consider picklist value updates
- Only existing picklists can be updated
