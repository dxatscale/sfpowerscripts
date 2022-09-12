
let $ = value => value.toUpperCase();
let parts = value => value.split('.');
let getObject = value => parts(value)[0];
let getField = value => parts(value)[1];
let removeWhiteSpace = value => value.replace(/\s/g,'');


module.exports = {$,parts,getObject,getField,removeWhiteSpace}