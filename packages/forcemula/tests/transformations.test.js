let _ = require('../lib/parser/transformations');
let MetadataType = require('../lib/MetadataTypes');


test('Custom fields should be returned with their original object as a prefix, and the correct MetadataType',() =>{

  let value = _.parseField(`My_text_field__c`,'Account');

  expect(value).toHaveProperty('instance','Account.My_text_field__c')
  expect(value).toHaveProperty('type',MetadataType.CUSTOM_FIELD);

  
})

test('Standard fields should be returned with their original object as a prefix, and the correct MetadataType',() =>{

  let value = _.parseField(`Industry`,'Account');

  expect(value).toHaveProperty('instance','Account.Industry')
  expect(value).toHaveProperty('type',MetadataType.STANDARD_FIELD);
})


test('User fields should be transformed to their original API name', () => {

  expect(_.transformToUserField('Owner.FirstName')).toBe('User.FirstName');
  expect(_.transformToUserField('Manager.FirstName')).toBe('User.FirstName');
  expect(_.transformToUserField('CreatedBy.FirstName')).toBe('User.FirstName');
  expect(_.transformToUserField('LastModifiedBY.area__c')).toBe('User.area__c');

})

test('The "transformToId" function should add "Id" at the end of the field name', () => {
  expect(_.transformToId('Owner.Manager')).toBe('Owner.ManagerId');
})

test('The "replaceRwithC" function should replace __r with __c', () => {
  expect(_.replaceRwithC('Owner.custom__r')).toBe('Owner.custom__c');
  //upper case
  expect(_.replaceRwithC('Owner.custom__R')).toBe('Owner.custom__c');
})

test('Custom Metadata should be converted to both custom fields and metadata types', () => {

  let field = '$CustomMetadata.Trigger_Context_Status__mdt.SRM_Metadata_c.Enable_After_Insert__c';
  let value = _.parseCustomMetadata(field)

  expect(value.length).toBe(3);

  value.forEach(val => {

    if(val.type == MetadataType.CUSTOM_FIELD){
      expect(val.instance).toBe('Trigger_Context_Status__mdt.Enable_After_Insert__c')
    }

    if(val.type == MetadataType.CUSTOM_METADATA_TYPE_RECORD){
      expect(val.instance).toBe('Trigger_Context_Status__mdt.SRM_Metadata_c')
    }

    if(val.type == MetadataType.CUSTOM_METADATA_TYPE){
      expect(val.instance).toBe('Trigger_Context_Status__mdt')
    }

  })    
})

test('Custom Labels should be parsed by removing the $Label prefix and adding the correct MetadataType', () => {

  let value = _.parseCustomLabel(`$Label.SomeName`);

  expect(value).toHaveProperty('instance','SomeName')
  expect(value).toHaveProperty('type',MetadataType.CUSTOM_LABEL);
})

test('Custom Settings should be parsed by removing the $Setting prefix and adding the correct MetadataType', () => {

  let types = _.parseCustomSetting(`$Setup.My_Setting__c.my_field__c`);

  let expected = [
    {
        type : MetadataType.CUSTOM_FIELD,
        instance:'My_Setting__c.my_field__c'
    },
    {
        type : MetadataType.CUSTOM_SETTING,
        instance:'My_Setting__c'
    }
  ]

  expect(types).toEqual(expect.arrayContaining(expected));

})


test('Object Types are parsed by removing the unnecessary prefixes and returning the field API name', () => {

  let types = _.parseObjectType(`$ObjectType.Center__c.Fields.My_text_field__c`);

  let expected = [
    {
      instance:'Center__c.My_text_field__c',
      type:MetadataType.CUSTOM_FIELD
    },
    {
      instance:'Center__c',
      type:MetadataType.CUSTOM_OBJECT
    }
  ]

  expect(types).toEqual(expect.arrayContaining(expected));

 
})

test('The "removePrefix" function should remove the $ character' ,() => {

  expect(_.removePrefix('$Organization.Name')).toBe('Organization.Name');
  expect(_.removePrefix('User.RoleId')).toBe('User.RoleId');

})


test('Parse object should determine if the object is standard or custom' ,() => {

  let result = _.parseObject('Account');

  let expected = {
    instance:'Account',
    type:MetadataType.STANDARD_OBJECT
  }

  expect(result).toEqual(expected);

  result = _.parseObject('Account__c');

  expected = {
    instance:'Account__c',
    type:MetadataType.CUSTOM_OBJECT
  }

  expect(result).toEqual(expected);

})

