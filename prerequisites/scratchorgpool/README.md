# Support Fields for ScratchOrg Pooling

Deploy the following custom object "ScratchOrgInfo", custom fields, validation rule, and workflow to a DevHub as prerequisites to enable the associated scratch org commands to work.

### How to deploy!

Install the supporting fields and validation rule to DevHub

`cd src_salesforce_packages/scratchorgpool`

`sfdx force:source:deploy -p force-app -u Devhub -w 30`
