# Prerequisite for ScratchOrg Pooling

Deploy the following additions to standard object "ScratchOrgInfo" such as a custom fields, validation rule, and workflow to a DevHub as prerequisites to enable the associated scratch org pool commands to work.

There are multiple options to install the supporting package to your environment

-  Installing the Unlocked package to your DevHub from URL

       1. Login to your DevHub
       2. Navigate to https://login.salesforce.com/packaging/installPackage.apexp?p0=04t1P000000gOqzQAE to install the **sfpower-scratchorg-pool** unlocked package into your DevHub.
       3. Select **Install for Admin Only**


-  Installing the Unlocked package to your DevHub using CLI


        sfdx force:package:install -p 04t1P000000gOqzQAE -u Devhub -r -a package -s AdminsOnly -w 30


### Issues with installing third party packages?


If you need to satisfy any compliance issues, such as installing third party packages are not permitted in production, You can utilize the below mechanisms. Please note that when you do this, any further updates have
to be manually synced up


-  Build an Org Depedendent Unlocked Package in your DevHub and deploy it


        1. git clone https://github.com/Accenture/sfpowerscripts

        1. cd sfpowerscripts/prerequisites/scratchorgpool

        1. sfdx force:package:create -n sfpower-scratchorg-pool -t Unlocked -r force-app -v <devhub_alias> --orgdependent

        1. sfdx force:package:version:create -p sfpower-scratchorg-pool -x -v <devhub_alias> -w 30

        1. Observe the package id created in sfdx-project.json

        1. sfdx force:package:install -p <packageVersionId> -u <devhub_alias> -w 30
