# Field history tracking resolution

* Status: <!-- optional -->
* Issue: <!-- optional -->
* Deciders: <!-- optional -->
* Date:  <!-- optional -->


## Context and Problem Statement

In Salesforce, field history tracking can only be deployed from source packages. Most implementation of dx@scale keeps a copy of all the fields that need to be tracked in a separate source package (field-history-tracking or similar) and deploys it as one of the last package using 'alwaysDeploy'. However, as the number of fields increases in larger projects, the package becomes larger and difficult to maintain as this has to be carefully aligned with the original source/unlocked package. In addition, since it's often the case that the project does not own the metadata definition of fields from managed packages, it doesn't make much sense to carry the metadata only for field history tracking purpose.


## Solution

To resolve this, the use of an additional source package should be discouraged and a mechanism needs to be implemented to automate the deployment of field history tracking. Specifically, for each package, a csv file (history-tracking.csv) that stores the list of all the to-be-tracked fields in that package can be maintained in a postdeploy_transform folder.

During the build stage, history-tracking.csv will be scanned to generate a JSON file that consists of the tracked fields (stored in artifacts). In case that manual updates on the csv file are missing due to human mistake, a filtering process will also be performed on the fields in the changed packages, any fields that have changes on the history tracking attributes (trackHistory and trackFeedHistory) will be written to the JSON file.

As a post installation step of a package, the entities (fields and objects since history tracking needs to be enabled on the object level) in the JSON file will be retrieved from the org and redeployed after updating the history tracking attributes (another option here is to merge the JSON files from all the packages together into one before retrieving entities from the org).

![image](./006-field-history-tracking-resolution.png)


### Issues/Challenges with the solution:
- This solution still doesn't address the challenge the organizing aspect of managed package fields. A possible area would be to store the csv file in src-env-specific-post
- This solution always applies FHT whenever the associated package is installed, We could consider applying a filter to fields that do not have it enabled l, reducing or eliminating the post deployment aspect considerably.
- The solution currently doesn't consider future 'bundling' or single transaction deployment.
- Additional training and education to end users to adopt this design as part of their workflows to handle field history tracking
