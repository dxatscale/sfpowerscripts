-----------sfpowerscripts orchestrator ------------------
command: release
Target Org: SIT
Release Definition: releasedef.yml
Artifact Directory: /Users/alan.ly/Workspaces/devops/easy-spaces-lwc/artifacts
Skip Packages If Already Installed: false
Dry-run: false
---------------------------------------------------------
Fetching artifact for esbasestyleslwc version develop_github
Fetching artifact for esspacemgmtlwc version develop_github
Fetching artifact for esbasecodelwc version develop_github
Fetching artifact for esobjects version develop_github
Checking Whether Package with ID 04t1P000000ka0fQAA is installed in  SIT
Package dependency sfpowerscripts-artifact: 04t1P000000ka0fQAA is already installed in target org
Checking Whether Package with ID 04t0H000000xVrwQAE is installed in  SIT
Installing package dependency Marketing Cloud: 04t0H000000xVrwQAE

Waiting for the package install request to complete. Status = IN_PROGRESS
Waiting for the package install request to complete. Status = IN_PROGERESS
Waiting for the package install request to complete. Status = IN_PROGRESS
Waiting for the package install request to complete. Status = IN_PROGRESS
Waiting for the package install request to complete. Status = IN_PROGRESS
Waiting for the package install request to complete. Status = IN_PROGRESS
Waiting for the package install request to complete. Status = IN_PROGRESS
Waiting for the package install request to complete. Status = IN_PROGRESS
Waiting for the package install request to complete. Status = IN_PROGRESS
Waiting for the package install request to complete. Status = IN_PROGRESS
Waiting for the package install request to complete. Status = IN_PROGRESS
Waiting for the package install request to complete. Status = IN_PROGRESS
Waiting for the package install request to complete. Status = IN_PROGRESS
Waiting for the package install request to complete. Status = IN_PROGRESS
Waiting for the package install request to complete. Status = IN_PROGRESS
Waiting for the package install request to complete. Status = IN_PROGRESS
Waiting for the package install request to complete. Status = IN_PROGRESS
Waiting for the package install request to complete. Status = IN_PROGRESS
Waiting for the package install request to complete. Status = IN_PROGRESS
Waiting for the package install request to complete. Status = IN_PROGRESS
Waiting for the package install request to complete. Status = IN_PROGRESS
Waiting for the package install request to complete. Status = IN_PROGRESS
Waiting for the package install request to complete. Status = IN_PROGRESS
Waiting for the package install request to complete. Status = IN_PROGRESS
Waiting for the package install request to complete. Status = IN_PROGRESS
Waiting for the package install request to complete. Status = IN_PROGRESS
Waiting for the package install request to complete. Status = IN_PROGRESS
Waiting for the package install request to complete. Status = IN_PROGRESS
Waiting for the package install request to complete. Status = IN_PROGRESS
Waiting for the package install request to complete. Status = IN_PROGRESS
Waiting for the package install request to complete. Status = IN_PROGRESS
Waiting for the package install request to complete. Status = IN_PROGRESS
Waiting for the package install request to complete. Status = IN_PROGRESS
Waiting for the package install request to complete. Status = IN_PROGRESS
Waiting for the package install request to complete. Status = IN_PROGRESS
Waiting for the package install request to complete. Status = IN_PROGRESS
Waiting for the package install request to complete. Status = IN_PROGRESS
Waiting for the package install request to complete. Status = IN_PROGRESS
Waiting for the package install request to complete. Status = IN_PROGRESS
Waiting for the package install request to complete. Status = IN_PROGRESS
Waiting for the package install request to complete. Status = IN_PROGRESS
Waiting for the package install request to complete. Status = IN_PROGRESS
Waiting for the package install request to complete. Status = IN_PROGRESS
Waiting for the package install request to complete. Status = IN_PROGRESS
Waiting for the package install request to complete. Status = IN_PROGRESS
Waiting for the package install request to complete. Status = IN_PROGRESS
Waiting for the package install request to complete. Status = IN_PROGRESS
Waiting for the package install request to complete. Status = IN_PROGRESS
Waiting for the package install request to complete. Status = IN_PROGRESS
Waiting for the package install request to complete. Status = IN_PROGRESS
Waiting for the package install request to complete. Status = IN_PROGRESS
Waiting for the package install request to complete. Status = IN_PROGRESS
Waiting for the package install request to complete. Status = IN_PROGRESS
Waiting for the package install request to complete. Status = IN_PROGRESS
Waiting for the package install request to complete. Status = IN_PROGRESS
Waiting for the package install request to complete. Status = IN_PROGRESS
Waiting for the package install request to complete. Status = IN_PROGRESS
Waiting for the package install request to complete. Status = IN_PROGRESS
Waiting for the package install request to complete. Status = IN_PROGRESS
Waiting for the package install request to complete. Status = IN_PROGRESS
Waiting for the package install request to complete. Status = IN_PROGRESS
Waiting for the package install request to complete. Status = IN_PROGRESS
Waiting for the package install request to complete. Status = IN_PROGRESS
Waiting for the package install request to complete. Status = IN_PROGRESS
Waiting for the package install request to complete. Status = IN_PROGRESS
Waiting for the package install request to complete. Status = IN_PROGRESS
Waiting for the package install request to complete. Status = IN_PROGRESS
Waiting for the package install request to complete. Status = IN_PROGRESS
Waiting for the package install request to complete. Status = IN_PROGRESS
Successfully installed package [04t0H000000xVrwQAE]
Querying Org Details
{
  attributes: {
    type: 'Organization',
    url: '/services/data/v51.0/sobjects/Organization/00D1y0000000agAEAQ'
  },
  Id: '00D1y0000000agAEAQ',
  InstanceName: 'CS114',
  IsSandbox: true,
  Name: 'Easy Spaces',
  OrganizationType: 'Developer Edition'
}

Found latest package manifest in ESSpaceMgmtLWC artifact
┌─────────────────┬─────────────────────────┐
│ Package         │ Version to be installed │
├─────────────────┼─────────────────────────┤
│ ESObjects       │ 50.0.6.16               │
├─────────────────┼─────────────────────────┤
│ ESBaseStylesLWC │ 50.0.6.16               │
├─────────────────┼─────────────────────────┤
│ ESBaseCodeLWC   │ 50.0.6.16               │
├─────────────────┼─────────────────────────┤
│ ESSpaceMgmtLWC  │ 50.0.5.17               │
└─────────────────┴─────────────────────────┘

-------------------------Installing Package------------------------------------
Name: ESBaseStylesLWC
Type: unlocked
Version Number: 50.0.6.16
Metadata Count: 12
-------------------------------------------------------------------------------

The following metadata will be deployed:
┌──────────────────────────┬────────────────────────┐
│ Metadata Type            │ API Name               │
├──────────────────────────┼────────────────────────┤
│ AuraDefinitionBundle     │ AppPage_3_9            │
├──────────────────────────┼────────────────────────┤
│ AuraDefinitionBundle     │ AppPage_4_8            │
├──────────────────────────┼────────────────────────┤
│ BrandingSet              │ LEXTHEMINGEasy_Spaces  │
├──────────────────────────┼────────────────────────┤
│ ContentAsset             │ EasySpacesTile01       │
├──────────────────────────┼────────────────────────┤
│ ContentAsset             │ EasySpaces_Logo1       │
├──────────────────────────┼────────────────────────┤
│ ContentAsset             │ EasySpaces_Page_Dark1  │
├──────────────────────────┼────────────────────────┤
│ ContentAsset             │ easy_spaces_tile_small │
├──────────────────────────┼────────────────────────┤
│ LightningExperienceTheme │ Easy_Spaces            │
├──────────────────────────┼────────────────────────┤
│ LightningComponentBundle │ imageGallery           │
├──────────────────────────┼────────────────────────┤
│ LightningComponentBundle │ imageTile              │
├──────────────────────────┼────────────────────────┤
│ LightningComponentBundle │ pill                   │
├──────────────────────────┼────────────────────────┤
│ LightningComponentBundle │ pillList               │
└──────────────────────────┴────────────────────────┘
Generated Command sfdx force:package:install --package 04t2s000000cC1NAAU -u SIT --noprompt --publishwait=10 --wait=120 --securitytype=AdminsOnly --upgradetype=Mixed --apexcompile=package
Waiting for the package install request to complete. Status = IN_PROGRESS

Waiting for the package install request to complete. Status = IN_PROGRESS

Waiting for the package install request to complete. Status = IN_PROGRESS

Waiting for the package install request to complete. Status = IN_PROGRESS

Successfully installed package [04t2s000000cC1NAAU]

Updating Org with new Artifacts ESBaseStylesLWC 50.0.6.16
-------------------------Installing Package------------------------------------
Name: ESBaseCodeLWC
Type: unlocked
Version Number: 50.0.6.16
Metadata Count: 23
-------------------------------------------------------------------------------

The following metadata will be deployed:
┌──────────────────────────┬───────────────────────────────────────────────────────────┐
│ Metadata Type            │ API Name                                                  │
├──────────────────────────┼───────────────────────────────────────────────────────────┤
│ AuraDefinitionBundle     │ openRecordAction                                          │
├──────────────────────────┼───────────────────────────────────────────────────────────┤
│ AuraDefinitionBundle     │ selectObject                                              │
├──────────────────────────┼───────────────────────────────────────────────────────────┤
│ ApexClass                │ CustomerServices                                          │
├──────────────────────────┼───────────────────────────────────────────────────────────┤
│ ApexClass                │ CustomerServicesTest                                      │
├──────────────────────────┼───────────────────────────────────────────────────────────┤
│ ApexClass                │ MarketServices                                            │
├──────────────────────────┼───────────────────────────────────────────────────────────┤
│ ApexClass                │ MarketServicesTest                                        │
├──────────────────────────┼───────────────────────────────────────────────────────────┤
│ ApexClass                │ TestDataFactory                                           │
├──────────────────────────┼───────────────────────────────────────────────────────────┤
│ CustomMetadata           │ Customer_Fields.Contact_Customer_Fields                   │
├──────────────────────────┼───────────────────────────────────────────────────────────┤
│ CustomMetadata           │ Customer_Fields.Lead_Customer_Fields                      │
├──────────────────────────┼───────────────────────────────────────────────────────────┤
│ Layout                   │ Customer_Fields__mdt-Customer Fields Layout               │
├──────────────────────────┼───────────────────────────────────────────────────────────┤
│ LightningComponentBundle │ errorPanel                                                │
├──────────────────────────┼───────────────────────────────────────────────────────────┤
│ LightningComponentBundle │ ldsUtils                                                  │
├──────────────────────────┼───────────────────────────────────────────────────────────┤
│ LightningMessageChannel  │ Flow_Status_Change                                        │
├──────────────────────────┼───────────────────────────────────────────────────────────┤
│ LightningMessageChannel  │ Tile_Selection                                            │
├──────────────────────────┼───────────────────────────────────────────────────────────┤
│ CustomObject             │ Customer_Fields__mdt                                      │
├──────────────────────────┼───────────────────────────────────────────────────────────┤
│ CustomField              │ Customer_Fields__mdt.Customer_City__c                     │
├──────────────────────────┼───────────────────────────────────────────────────────────┤
│ CustomField              │ Customer_Fields__mdt.Customer_Draft_Status_Values__c      │
├──────────────────────────┼───────────────────────────────────────────────────────────┤
│ CustomField              │ Customer_Fields__mdt.Customer_Email__c                    │
├──────────────────────────┼───────────────────────────────────────────────────────────┤
│ CustomField              │ Customer_Fields__mdt.Customer_Name__c                     │
├──────────────────────────┼───────────────────────────────────────────────────────────┤
│ CustomField              │ Customer_Fields__mdt.Customer_Reservation_Status_Value__c │
├──────────────────────────┼───────────────────────────────────────────────────────────┤
│ CustomField              │ Customer_Fields__mdt.Customer_State__c                    │
├──────────────────────────┼───────────────────────────────────────────────────────────┤
│ CustomField              │ Customer_Fields__mdt.Customer_Status__c                   │
├──────────────────────────┼───────────────────────────────────────────────────────────┤
│ CustomField              │ Customer_Fields__mdt.Sobject_Type__c                      │
└──────────────────────────┴───────────────────────────────────────────────────────────┘
Generated Command sfdx force:package:install --package 04t2s000000cC1cAAE -u SIT --noprompt --publishwait=10 --wait=120 --securitytype=AdminsOnly --upgradetype=Mixed --apexcompile=package
Waiting for the package install request to complete. Status = IN_PROGRESS

Waiting for the package install request to complete. Status = IN_PROGRESS

Waiting for the package install request to complete. Status = IN_PROGRESS

Waiting for the package install request to complete. Status = IN_PROGRESS

Successfully installed package [04t2s000000cC1cAAE]

Updating Org with new Artifacts ESBaseCodeLWC 50.0.6.16


Checking out branch sfp_changelog_develop
Generating changelog...
Updating sit org with release-1.0-1(0)
[![sit-Release-1.0-1(0)-green](https://img.shields.io/static/v1?label=sit&message=Release-1.0-1(0)&color=green)](#7df66f58e93be435fcb22019c2efe0827f2862ad)
<a id=7df66f58e93be435fcb22019c2efe0827f2862ad></a>
# Release-1.0-1
### Artifacts :package:
- **ESBaseCodeLWC**     v50.0.6.16 (2bc11f53)

- **ESBaseStylesLWC**     v50.0.6.16 (2bc11f53)

### Work Items :gem:
- SAM-6
- SAM-158
- SAM-162
- SAM-178

### Commits :book:

#### ESBaseCodeLWC
| Date       | Time     | Commit ID | Commit Message                                                               |
| ---------- | -------- | --------- | ---------------------------------------------------------------------------- |
| 25/01/2021 | 11:01:55 | c8dbab13  | Add persist credential to PR (#6)                                            |
| 19/10/2020 | 17:30:31 | d7124579  | feat: winter '21 release updates (#178)                                      |
| 28/09/2020 | 17:52:59 | e4fd5b2c  | Setup sa11y and implement accessibility tests (#162)                         |
| 05/09/2020 | 02:10:49 | 9ca5cf96  | feat:object agnostic design for apex code for Customer List component (#158) |



#### ESBaseStylesLWC
| Date       | Time     | Commit ID | Commit Message                                                      |
| ---------- | -------- | --------- | ------------------------------------------------------------------- |
| 19/10/2020 | 17:30:31 | d7124579  | feat: winter '21 release updates (#178)                             |



Pushing changelog files to sfp_changelog_develop
Successfully generated changelog
----------------------------------------------------------------------------------------------------

Package Dependencies
   1 succeeded
   1 skipped
   0 failed

Deployment
   2 succeeded
   0 failed

Elapsed Time: 00:12:09
----------------------------------------------------------------------------------------------------
