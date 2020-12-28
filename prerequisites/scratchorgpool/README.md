# Support Fields for ScratchOrg Pooling

Deploy the following additions to standard object "ScratchOrgInfo" such as a custom fields, validation rule, and workflow to a DevHub as prerequisites to enable the associated scratch org commands to work.

### How to deploy!

- Clone sfpowerscripts repo

- Install the supporting fields and validation rule to DevHub

`cd prerequisites/scratchorgpool`

`sfdx force:source:deploy -p force-app -u Devhub -w 30`
