The following metadata will be deployed:

| Metadata Type            | API Name                                                  |
|--------------------------|-----------------------------------------------------------|
| AuraDefinitionBundle     | openRecordAction                                          |
| AuraDefinitionBundle     | selectObject                                              |
| ApexClass                | CustomerServices                                          |
| ApexClass                | CustomerServicesTest                                      |
| ApexClass                | MarketServices                                            |
| ApexClass                | MarketServicesTest                                        |
| ApexClass                | TestDataFactory                                           |
| CustomMetadata           | Customer_Fields.Contact_Customer_Fields                   |
| CustomMetadata           | Customer_Fields.Lead_Customer_Fields                      |
| Layout                   | Customer_Fields__mdt-Customer Fields Layout               |
| LightningComponentBundle | errorPanel                                                |
| LightningComponentBundle | ldsUtils                                                  |
| LightningMessageChannel  | Flow_Status_Change                                        |
| LightningMessageChannel  | Tile_Selection                                            |
| CustomObject             | Customer_Fields__mdt                                      |
| CustomField              | Customer_Fields__mdt.Customer_City__c                     |
| CustomField              | Customer_Fields__mdt.Customer_Draft_Status_Values__c      |
| CustomField              | Customer_Fields__mdt.Customer_Email__c                    |
| CustomField              | Customer_Fields__mdt.Customer_Name__c                     |
| CustomField              | Customer_Fields__mdt.Customer_Reservation_Status_Value__c |
| CustomField              | Customer_Fields__mdt.Customer_State__c                    |
| CustomField              | Customer_Fields__mdt.Customer_Status__c                   |
| CustomField              | Customer_Fields__mdt.Sobject_Type__c                      |

Generated Command sfdx force:package:install --package 04t2s000000cC1cAAE -u SIT --noprompt --publishwait=10 --wait=120 --securitytype=AdminsOnly --upgradetype=Mixed --apexcompile=package