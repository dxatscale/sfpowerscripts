# Field history tracking resolution

* Status: Accepted
* Deciders: Azlam, Rody, Meng
* Date: 19/12/2022


## Context and Problem Statement

In Salesforce, field history tracking can only be deployed from source packages. Most implementation of dx@scale keeps a copy of all the fields that need to be tracked in a separate source package (field-history-tracking or similar) and deploys it as one of the last package using 'alwaysDeploy'. However, as the number of fields increases in large projects, this package becomes larger and more difficult to maintain - the tracked fields have to be carefully aligned with the original source/unlocked package. In addition, since it's often the case that the project does not own the metadata definition of fields from managed packages, it doesn't make much sense to carry the metadata only for field history tracking purposes.


## Solution

To resolve this, the use of an additional source package should be discouraged and a mechanism needs to be implemented to automate the deployment of field history tracking. Specifically, a YAML file (history-tracking.yml) that stores all the to-be-tracked fields needs to be maintained in a postDeploy folder.

During the build stage, the history-tracking.yaml file will be scanned to generate a fhtFields object that contains all the tracked fields (stored in the sfpPackage deployment artifact). In case manual updates on the YAML file are missing due to human mistake, an analysing process will also be performed on the fields in the changed packages - any fields that have changes on the history tracking attributes (trackHistory and trackFeedHistory) will be picked up and written to the same object.

As a post installation step, the fields stored in the fhtFields object will be retrieved from the org and redeployed after updating the history tracking attributes.


### Issues/Challenges with the solution:
- This solution addresses the challenge that the organizing aspect of managed package field by storing a csv/yaml file in src-env-specific-post
- This solution always applies FHT whenever the associated package is installed, but only for fields that have it not enabled as an optimization
- The solution currently doesn't consider future 'bundling' or single transaction deployment.
- Additional training and education to end users to adopt this design as part of their workflows to handle field history tracking
