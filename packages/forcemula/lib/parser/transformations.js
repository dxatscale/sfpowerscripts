const {STANDARD_RELATIONSHIP_ID_NAME,DOLLAR_SIGN} = require('../parser/grammar');
const cpqMapping = require('../mappings/cpq')
const {$,getField,parts} = require('../utils');
const MetadataType = require('../MetadataTypes');
const {isCustom,isCustomMetadata,isStandardRelationship} = require('../parser/grammarChecks');

let transformToId = value => value+=STANDARD_RELATIONSHIP_ID_NAME;

let transformToUserField = value => `User.${getField(value)}`;

let replaceRwithC = value => value.slice(0,-1).concat('c');

let createApiName = (object,field) => `${object}.${field}`;

let parseCustomMetadata = value => {

    //$CustomMetadata.Trigger_Context_Status__mdt.SRM_Metadata_c.Enable_After_Insert__c
    let [mdType,sobject,sobjInstance,fieldName] = parts(value);

    return [
        {
            instance: createApiName(sobject,sobjInstance),
            type: MetadataType.CUSTOM_METADATA_TYPE_RECORD
        },
        {
            instance : sobject,
            type: MetadataType.CUSTOM_METADATA_TYPE
        },
        parseField(fieldName,sobject) 
    ]
}

let parseCustomLabel = value => {

    return {
        type:MetadataType.CUSTOM_LABEL,
        instance: getField(value)
    }
}

let parseCustomSetting = value => {

    let [prefix,object,field] = parts(value);

    return [
        {
            type:MetadataType.CUSTOM_SETTING,
            instance:object
        },
        parseField(field,object) 
    ]
}

let parseObjectType = value => {

    //$ObjectType.Center__c.Fields.My_text_field__c
    let [mdType,sobject,prop,fieldName] = parts(value);

    return [
        parseField(fieldName,sobject),
        parseObject(sobject)
    ]
        
}

let parseField = (value,object) => {

    if(!value.includes('.')){
        value =  createApiName(object,value);
    }

    return {
        type: (isCustom(value) ? MetadataType.CUSTOM_FIELD : MetadataType.STANDARD_FIELD ),
        instance: value
    }
    
}

let parseObject = (object) => {

    let type = MetadataType.STANDARD_OBJECT;

    if(isCustom(object)){
        type = MetadataType.CUSTOM_OBJECT
    }
    else if(isCustomMetadata(object)){
        type = MetadataType.CUSTOM_METADATA_TYPE;
    }
    else if(!isStandardRelationship(object)){
        type = MetadataType.UNKNOWN_RELATIONSHIP;
    }

    return {
        type,
        instance: object
    }
    
}

let removePrefix = value =>  value.startsWith(DOLLAR_SIGN) ? value.substring(1) : value

let removeFirstAndLastChars = value => value.slice(1).slice(0,-1)

let mapCPQField = (value,originalObject) => {

    let [relationshipName,field] = parts(value);

    let apiName = cpqMapping[$(originalObject)]?.[$(relationshipName)];

    return createApiName(apiName ? apiName : relationshipName,field)

}

module.exports = {
    transformToId,replaceRwithC,parseCustomMetadata,
    parseCustomLabel,parseCustomSetting,parseObjectType,
    parseField,parseObject,removePrefix,removeFirstAndLastChars,
    mapCPQField,createApiName,transformToUserField
}