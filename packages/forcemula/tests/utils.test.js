let _ = require('../lib/utils');

let fieldName = 'Opportunity.StageName';
let fieldNameParts = ['Opportunity','StageName'];

test('White space should be removed',() =>{
  expect(_.removeWhiteSpace(' there is space ')).toBe('thereisspace');
})

test('Word should be converted to upper case',() =>{
    expect(_.$('hi')).toBe('HI');
})

test('Parts should return the parts based on a dot delimeter', () => {
    expect(_.parts(fieldName)).toEqual(expect.arrayContaining(fieldNameParts));
})

test('Get object should return the object name', () => {
    expect(_.getObject(fieldName)).toEqual(fieldNameParts[0]);
})

test('Get field should return the field name', () => {
    expect(_.getField(fieldName)).toEqual(fieldNameParts[1]);
})