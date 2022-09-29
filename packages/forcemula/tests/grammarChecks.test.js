let _ = require('../lib/parser/grammarChecks');

test('The * should be considered an operator',() =>{
    expect(_.isOperator('*')).toBe(true);
  })
  
  test('The word ISBLANK should not be an operator',() =>{
    expect(_.isOperator('ISBLANK')).toBe(false);
  })
  
  test('Operators should be identified even if there is white space around them',() =>{
    expect(_.isOperator('* ')).toBe(true);
  })
  
  test('The word ISBLANK should be considered a function',() =>{
    expect(_.isFunction('ISBLANK')).toBe(true);
  })
  
  test('The case (upper or lower) of a function should not affect its determination',() =>{
    expect(_.isFunction('IsBLank')).toBe(true);
  })
  
  test('Functions should be identified even if theres white space around them',() =>{
    expect(_.isFunction('IsBLank ')).toBe(true);
  })
  
  test('The "isFunction" function should return false on falsy values',() =>{
    expect(_.isFunction(undefined)).toBe(false);
    expect(_.isFunction('')).toBe(false);
    expect(_.isFunction(null)).toBe(false);
  })
  
  
  test('Whether a field is custom or standard is determined by whether the field ends with __c, irrespective of the case',() =>{
    expect(_.isCustom('Account__C')).toBe(true);
    expect(_.isCustom('AccountId')).toBe(false);
  })
  
  
  test('Only certain operators should be considered "interesting" ',() =>{
  
    expect(_.isInterestingOperator('*')).toBe(true);
    expect(_.isInterestingOperator(',')).toBe(false);
    expect(_.isInterestingOperator('(')).toBe(false);
  
  })
  
  test('If a field does not end with __r, it should be considered a standard relationship',() =>{
  
    expect(_.isStandardRelationship('Account')).toBe(true);
    expect(_.isStandardRelationship('Account__r')).toBe(false);
    expect(_.isStandardRelationship('Lead__R')).toBe(false);
  
  })
  
  test('Certain fields (such as Owner, CreatedBy, etc.) should be considered User fields', () => {
  
    expect(_.isUserField('Owner.FirstName')).toBe(true);
    expect(_.isUserField('Manager.FirstName')).toBe(true);
    expect(_.isUserField('CreatedBy.FirstName')).toBe(true);
    expect(_.isUserField('LastModifiedBY.FirstName')).toBe(true);
    //upper case
    expect(_.isUserField('OWNER.FirstName')).toBe(true);
    expect(_.isUserField('MANAger.FirstName')).toBe(true);
    expect(_.isUserField('CREATEDBy.FirstName')).toBe(true);
    expect(_.isUserField('lastmodifiEDBY.FirstName')).toBe(true);
  
  })
  
  
  test('Custom Metadata is determined by the presence of the word __MDT anywhere in the field name', () => {
    expect(_.isCustomMetadata(`$CustomMetadata.Trigger_Context_Status__mdt.SRM_Metadata_c.Enable_After_Insert__c`)).toBe(true);
    //upper case
    expect(_.isCustomMetadata(`$CustomMetadata.Trigger_Context_Status__mDT.SRM_Metadata_c.Enable_After_Insert__c`)).toBe(true);
  })
  

  
  test('Custom Labels are determined by the $Label prefix', () => {
    expect(_.isCustomLabel(`$Label.SomeName`)).toBe(true);
    //upper case
    expect(_.isCustomLabel(`$LaBEL.SomeName`)).toBe(true);
  })
  
  

  
  test('Custom Settings are determined by the $Setup prefix', () => {
    expect(_.isCustomSetting(`$Setup.SomeName`)).toBe(true);
    //upper case
    expect(_.isCustomSetting(`$SeTUP.SomeName`)).toBe(true);
  })
  

  
  test('Object Types are determined by the $ObjectType prefix', () => {
    expect(_.isObjectType(`$ObjectType.Center__c.Fields.My_text_field__c`)).toBe(true);
    //upper case
    expect(_.isObjectType(`$ObjectTYPE.Center__c.Fields.My_text_field__c`)).toBe(true);
  })
  

  
  test('A field is considered a relationship field if there is a dot in between' ,() => {
  
    expect(_.isRelationshipField('Account.Name')).toBe(true);
    expect(_.isRelationshipField('Name')).toBe(false);
  
  })
  
 
  
  test('Certain prefixes should be considered of a special type' ,() => {
  
    expect(_.isSpecialPrefix('$Organization')).toBe(true);
    expect(_.isSpecialPrefix('$PROfile')).toBe(true);
    expect(_.isSpecialPrefix('$ObjectType')).toBe(false);
  
  })
  
  test('If a field ends in ParentId, it should be considered a parent field' ,() => {
  
    expect(_.isParentField('Account.Parent')).toBe(false);
    expect(_.isParentField('Account.parEnTid')).toBe(true);
  
  })
  
  test('The word "parent" in a custom field should determine that this is a parent relationship' ,() => {
  
    expect(_.isParent('ParentId')).toBe(false);
    expect(_.isParent('Parent')).toBe(true);
  
  })
  

  