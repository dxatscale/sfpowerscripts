**Context and Problem Statement**

SFPowerScripts currently does not have the capability to perform environment pooling for sandboxes. For some teams it can be too complex or challenging and not a viable option to transition to scratch orgs and Sandboxes are the only option. In situations like this a middle ground can be found with Sandbox pooling, which would allow project teams to experience the benefits of environment provisioning in a similar manner to scratch orgs but with the ease of use that Sandboxes can offer.




## Solution

To achieve a scratch org pooling like user experience, several key pieces of functionality will need to be built:
## New Custom Object
To successfully build a pool we will need to recreate the capabilities of the ScratchOrgInfo object as a way of maintaining records of environments, OOTB SF has the tooling object SandBoxInfo as a record that has an association to an org, The problem with this is that the tooling object cannot have new fields built on top of it. To overcome this a new sObject will need to be created with an association to the Tooling object as per the diagram below: 

[SandboxInfoObject] -------------  [SandBoxInfo]

Reference to tooling object: <https://developer.salesforce.com/docs/atlas.en-us.210.0.api_tooling.meta/api_tooling/tooling_api_objects_sandboxinfo.htm> 




## Sandbox Creation
The above are core capabilities of a pooling mechanism, to achieve this functionality we will leverage the SF rest api for creation and deletion. For the creation and deletion of Sandboxes there are 2 proposed solutions as to how we could achieve this functionality.

### Create Sandbox
1) Create Sandbox through Rest API

The Salesforce rest API has the ability to create a Sandbox when the endpoint below is queries: 

**Endpoint**: {{\_endpoint}}/services/data/v{{version}}/tooling/sobjects/SandboxInfo

This endpoint takes several parameters such as SandboxName and LicenseType and on success returns an ID associated to the created SandboxInfo object that is associated to the Sandbox.

1) Create Sandbox through SFDX cli

The SFDX cli has a command sfdx force:org:create  which will generate a sandbox based on the criteria of a Sandbox definition file, this file contains information about the sandbox such as, SandboxName, LicenseType, sourceSandbox etc.

Similarly, to the Rest API on execution of this command an ID is returned for the SandBoxInfo record that is associated to the Sandbox being provisioned.

Given the direction the SFpowerscripts tooling is going in as to eliminating its dependency on the SFDX cli, the recommended approach would be to use the rest API to create environments.


## Expired Org purge
A scheduled process will need to be implemented to perform a deletion of existing Sandboxes, this functionality attempts to recreate the expiration experience similar to scratch orgs. To achieve this we will leverage an expiration date field on the SandboxInfo sObject which is set at time or org creation and an isActive field which will be flagged as false if the current date exceeds the expiration date.

[START]-----> [Scheduled Org deletion process is executed] ------> [rest api queries all SandBoxInfoObjects in devhub and returns a list of all records where isActive is false] -------> [Using the OrdID value from each record that corresponds to the SandBoxInfo record perform a delete] -------- [After all sandBoxInfo records are deleted, delete all SandBoxInfoObject records] ------ [END]
### SandBoxInfoObject record retrieval 
Retrieval of the SandBoxInfoObject and SandBoxInfo records will be handled through a SOQL query sent through the endpoint below: 

Endpoint: {{_endpoint}}/services/data/v/{{version}}/query/?q=SELECT ID, OrgID__c, isActive__c From SandBoxInfoObject__c Where isActive__c=true
### Sandbox Deletion
Sandbox deletion will be handled by querying the endpoint below, using the query parameter SANDBOX\_INFO\_ID which will be taken from the returned records from the SOQL above, will perform a deletion of the SandboxInfo record and delete the corresponding org. Note this is an example below and a production solution would implement bulkification. 

Endpoint: {{_endpoint}}/services/data/v/{{version}}/tooling/sobjects/SandboxInfo/:SANDBOX_INFO_ID
Query Param: SANDBOX_INFO_ID = ORGID__c


## Sandbox Authentication
Sandbox Authentication will be handled purely by the CI server through JWT authentication. JWT is best practice for authenticating to Salesforce through server-to-server communication. This authentication  protocol will facilitate authorization to DevHub, access to the created Sandbox for code deployment and access to the org to provision user accounts.

## Code Deployment
Code deployment will be facilitated through the CI server using the practices outlined in the Scratch org Pool Prepare command from SFPowerScripts 

## Org License Checking
The Rest API currently does not have capability to pull the number of licenses for available Sandboxes. As a work around solution, we will get the user to define the SF license their org is under which has a defined limit of available dev edition orgs, Unlimited enterprise has 100 etc., query the SandboxInfo object to get a list of all provisioned orgs and do a calculation to determine how many licenses are available

[START]------> [Pull a list of all SandboxInfo objects and count the number of in use dev sandboxes]-------> [Number of Sandboxes in use - total number of licenses provided by the SF license]-------> [END]
## End User Workflow - Retrieving an org
When a user wants to retrieve a Sandbox from the pool and begin development, they will first navigate to their repository and manually execute a pipeline or action which will prompt them to input their email address, This action will trigger an automated process where the CI server will authenticate against the DevHub, retrieve an unallocated SandBoxInfoObject, Authenticate against that Sandbox and create a user account associated to the input users email address. The end user will receive an email indicating their user account was created and will contain the user credentials for login.

[START]-------------[Users execute action from repository and input email address]-------------[An unassigned SandBoxInfoObject record is retrieved and marked as assigned]-------------[The Org associated to the record is authenticated against]-------------[A new user account is created with the end users email address assigned]-------------[User receives an email and login details for their sandbox]

**Decision**

New functionality will be built for SFPowerScripts to support sandbox pooling and a new sObject will be built to support the capability.
