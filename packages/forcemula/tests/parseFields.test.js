let parseType = require('../lib/parseTypes');
const MetadataType = require('../lib/MetadataTypes');
let originalObject = 'Account';


test('Passing a single STANDARD field name should return the same field, but with the original object as a prefix',() =>{

    let types = parseType('Name',originalObject);

    let expected = [
        {
            type : MetadataType.STANDARD_FIELD,
            instance:'Account.Name'
        },
        {
            type : MetadataType.STANDARD_OBJECT,
            instance:'Account'
        }
    ]

    expect(types).toEqual(expect.arrayContaining(expected));  
})

test('Passing a single CUSTOM field name should return the same field, but with the original object as a prefix',() =>{

    let types = parseType('custom__C','lead__c');

    let expected = [
        {
            type : MetadataType.CUSTOM_FIELD,
            instance:'lead__c.custom__C'
        },
        {
            type : MetadataType.CUSTOM_OBJECT,
            instance:'lead__c'
        }
    ]

    expect(types).toEqual(expect.arrayContaining(expected));  
})



test('Standard self-referential relationships should be converted back to their original type',() =>{

    let types = parseType(
        'Opportunity.Account.Parent.Parent.Parent.Parent.pareNt.AccountNumber',
        'OpportunityLineItem'
    );

    let expected = [
        {
            type : MetadataType.STANDARD_FIELD,
            instance:'OpportunityLineItem.OpportunityId'
        },
        {
            type : MetadataType.STANDARD_FIELD,
            instance:'Opportunity.AccountId'
        },
        {
            type : MetadataType.STANDARD_FIELD,
            instance:'Account.ParentId'
        },
        {
            type : MetadataType.STANDARD_FIELD,
            instance:'Account.AccountNumber'
        },
        {
            type : MetadataType.STANDARD_OBJECT,
            instance:'OpportunityLineItem'
        }
        ,
        {
            type : MetadataType.STANDARD_OBJECT,
            instance:'Opportunity'
        },
        {
            type : MetadataType.STANDARD_OBJECT,
            instance:'Account'
        }
    ]

    expect(types).toEqual(expect.arrayContaining(expected));  
})



test('STANDARD relationships should be converted to their original field name',() =>{

    let types = parseType('Account.Opportunity.Custom__c','Contact');

    let expected = [
        {
            type : MetadataType.STANDARD_FIELD,
            instance:'Contact.AccountId'
        },
        {
            type : MetadataType.STANDARD_FIELD,
            instance:'Account.OpportunityId'
        },
        {
            type : MetadataType.CUSTOM_FIELD,
            instance:'Opportunity.Custom__c'
        }
    ]

    expect(types).toEqual(expect.arrayContaining(expected)); 
  
})


test('CUSTOM relationships should be converted to their original field name',() =>{

    let types = parseType('Account.Opportunity__r.Name','Contact');

    let expected = [
        {
            type : MetadataType.STANDARD_FIELD,
            instance:'Contact.AccountId'
        },
        {
            type : MetadataType.CUSTOM_FIELD,
            instance:'Account.Opportunity__c'
        },
        {
            type : MetadataType.STANDARD_FIELD,
            instance:'Opportunity__r.Name'
        }
    ]

    expect(types).toEqual(expect.arrayContaining(expected)); 
  
})


test('A mix of custom and standard relationships should result in the same conversation seen in the previous 2 tests',() =>{

    let types = parseType('Account.Opportunity__r.Asset.Contact.FirstName','Lead');

    let expected = [
        {
            type : MetadataType.STANDARD_FIELD,
            instance:'Lead.AccountId'
        },
        {
            type : MetadataType.CUSTOM_FIELD,
            instance:'Account.Opportunity__c'
        },
        {
            type : MetadataType.STANDARD_FIELD,
            instance:'Opportunity__r.AssetId'
        },
        {
            type : MetadataType.STANDARD_FIELD,
            instance:'Asset.ContactId'
        },
        {
            type : MetadataType.STANDARD_FIELD,
            instance:'Contact.FirstName'
        }
    ]

    expect(types).toEqual(expect.arrayContaining(expected)); 
  
})



test('A chain of custom relationships should be supported',() =>{

    let types = parseType('Account.first__r.second__r.third__r.fourth__r.FirstName','Order');

    let expected = [
        {
            type : MetadataType.STANDARD_FIELD,
            instance:'Order.AccountId'
        },
        {
            type : MetadataType.CUSTOM_FIELD,
            instance:'Account.first__c'
        },
        {
            type : MetadataType.CUSTOM_FIELD,
            instance:'first__r.second__c'
        },
        {
            type : MetadataType.CUSTOM_FIELD,
            instance:'second__r.third__c'
        },
        {
            type : MetadataType.CUSTOM_FIELD,
            instance:'third__r.fourth__c'
        }
        ,
        {
            type : MetadataType.CUSTOM_FIELD,
            instance:'third__r.fourth__c'
        }
    ]

    expect(types).toEqual(expect.arrayContaining(expected)); 
  
})




test('User-related fields should be transformed to User.[field]', () => {

    let types = parseType('Account.Owner.Contact.Account.LastModifiedBy.Department','Order');

   let expected = [
        {
            type : MetadataType.STANDARD_FIELD,
            instance:'Order.AccountId'
        },
        {
            type : MetadataType.STANDARD_FIELD,
            instance:'Account.OwnerId'
        },
        {
            type : MetadataType.STANDARD_FIELD,
            instance:'User.ContactId'
        },
        {
            type : MetadataType.STANDARD_FIELD,
            instance:'Contact.AccountId'
        },
        {
            type : MetadataType.STANDARD_FIELD,
            instance:'Account.LastModifiedById'
        }
        ,
        {
            type : MetadataType.STANDARD_FIELD,
            instance:'User.Department'
        }
    ]

    expect(types).toEqual(expect.arrayContaining(expected));

})



test('Custom metadata fields should be parsed to both types and fields (custom fields)', () => {

    let types = parseType('$CustomMetadata.Trigger_Context_Status__mdt.SRM_Metadata_c.Enable_After_Insert__c','Case');

    let expected = [
        {
            type : MetadataType.CUSTOM_FIELD,
            instance:'Trigger_Context_Status__mdt.Enable_After_Insert__c'
        },
        {
            type : MetadataType.CUSTOM_METADATA_TYPE_RECORD,
            instance:'Trigger_Context_Status__mdt.SRM_Metadata_c'
        }
    ]

    expect(types).toEqual(expect.arrayContaining(expected));

})

test('Custom metadata fields should be parsed to both types and fields (standard fields)', () => {

    let types = parseType('$CustomMetadata.Trigger_Context_Status__mdt.SRM_Metadata_c.QualifiedApiName','Case');

    let expected = [
        {
            type : MetadataType.STANDARD_FIELD,
            instance:'Trigger_Context_Status__mdt.QualifiedApiName'
        },
        {
            type : MetadataType.CUSTOM_METADATA_TYPE_RECORD,
            instance:'Trigger_Context_Status__mdt.SRM_Metadata_c'
        }
    ]

    expect(types).toEqual(expect.arrayContaining(expected));

})



test('Custom Settings should be parsed as both a type and a field instance', () => {

    let types = parseType('$Setup.Customer_Support_Setting__c.Email_Address__c','Case');

    let expected = [
        {
            type : MetadataType.CUSTOM_FIELD,
            instance:'Customer_Support_Setting__c.Email_Address__c'
        },
        {
            type : MetadataType.CUSTOM_SETTING,
            instance:'Customer_Support_Setting__c'
        }
    ]

    expect(types).toEqual(expect.arrayContaining(expected));

    //standard fields in custom settings

    types = parseType('$Setup.Customer_Support_Setting__c.DeveloperName','Case');

    expected = [
        {
            type : MetadataType.STANDARD_FIELD,
            instance:'Customer_Support_Setting__c.DeveloperName'
        },
        {
            type : MetadataType.CUSTOM_SETTING,
            instance:'Customer_Support_Setting__c'
        }
    ]

    expect(types).toEqual(expect.arrayContaining(expected));

})

test('Custom Labels should be parsed to their API name', () => {

    let types = parseType('$Label.AWS_Access_Key','Case');

    let expected = [
        {
            type : MetadataType.CUSTOM_LABEL,
            instance:'AWS_Access_Key'
        }
    ]

    expect(types).toEqual(expect.arrayContaining(expected));

    let notExpected = [
        {
            type : MetadataType.STANDARD_FIELD,
            instance:'Case.LabelId'
        }
    ]

    expect(types).not.toEqual(expect.arrayContaining(notExpected));

})

test('Object Types should be parsed to their API name (standard fields)', () => {

    let types = parseType('$ObjectType.Center__c.Fields.CreatedDate','Case');

    let expected = [
        {
            type : MetadataType.STANDARD_FIELD,
            instance:'Center__c.CreatedDate'
        }
    ]

    expect(types).toEqual(expect.arrayContaining(expected));

    let notExpected = [
        {
            type : MetadataType.STANDARD_FIELD,
            instance:'Case.ObjectTypeId'
        }
    ]

    expect(types).not.toEqual(expect.arrayContaining(notExpected));

})

test('Object Types should be parsed to their API name (custom fields)', () => {

    let types = parseType('$ObjectType.Center__c.Fields.Custom__c','Case');

    let expected = [
        {
            type : MetadataType.CUSTOM_FIELD,
            instance:'Center__c.Custom__c'
        }
    ]

    expect(types).toEqual(expect.arrayContaining(expected));

    let notExpected = [
        {
            type : MetadataType.STANDARD_FIELD,
            instance:'Case.ObjectTypeId'
        }
    ]

    expect(types).not.toEqual(expect.arrayContaining(notExpected));

})


test(`The $ prefix should be removed from special objects and  
    the resulting field should not be linked to the original object`, () => {

    let types = parseType('$User.Manager.Employee_Id__c','Case');

    let expected = [
        {
            type : MetadataType.STANDARD_FIELD,
            instance:'User.ManagerId'
        },
        {
            type : MetadataType.CUSTOM_FIELD,
            instance:'User.Employee_Id__c'
        }
    ]

    expect(types).toEqual(expect.arrayContaining(expected));

    let notExpected = [
        {
            type:MetadataType.STANDARD_FIELD,
            instance:'Case.UserId'
        }
    ]

    expect(types).not.toEqual(expect.arrayContaining(notExpected));  

    //$Organization type
    
    types = parseType('$Organization.TimeZone','Case');

    expected = [
        {
            type : MetadataType.STANDARD_FIELD,
            instance:'Organization.TimeZone'
        }
    ]

    expect(types).toEqual(expect.arrayContaining(expected));

    notExpected = [
        {
            type:MetadataType.STANDARD_FIELD,
            instance:'Case.OrganizationId'
        }
    ]

    expect(types).not.toEqual(expect.arrayContaining(notExpected));  

})






