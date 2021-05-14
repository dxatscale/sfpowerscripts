The following metadata will be deployed:

| Metadata Type            | API Name               |
|--------------------------|------------------------|
| AuraDefinitionBundle     | AppPage_3_9            |
| AuraDefinitionBundle     | AppPage_4_8            |
| BrandingSet              | LEXTHEMINGEasy_Spaces  |
| ContentAsset             | EasySpacesTile01       |
| ContentAsset             | EasySpaces_Logo1       |
| ContentAsset             | EasySpaces_Page_Dark1  |
| ContentAsset             | easy_spaces_tile_small |
| LightningExperienceTheme | Easy_Spaces            |
| LightningComponentBundle | imageGallery           |
| LightningComponentBundle | imageTile              |
| LightningComponentBundle | pill                   |
| LightningComponentBundle | pillList               |

Generated Command sfdx force:package:install --package 04t2s000000cC1NAAU -u SIT --noprompt --publishwait=10 --wait=120 --securitytype=AdminsOnly --upgradetype=Mixed --apexcompile=package