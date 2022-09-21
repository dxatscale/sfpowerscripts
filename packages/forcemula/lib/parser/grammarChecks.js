const G = require('../parser/grammar');
const {$,getField,getObject,parts} = require('../utils');

let isCommentStart = value => value == G.COMMENT_START;
let isCommentEnd = value => value ==  G.COMMENT_END;

let isNothing = value => (value == null || value == undefined || value == '');

let isNumber = value => !isNaN(value);

let isInterestingOperator = operator => ![',','(',')'].includes(operator);

let isStandardRelationship = value => !$(value).endsWith(G.RELATIONSHIP_SUFFIX);

let isRelationshipField = value => value.includes('.');

let isCustom = value => $(value).endsWith(G.CUSTOM_ENTITY_SUFFIX);

let isUserField = value => G.USER_FIELDS.includes($(getObject(value)));

let isCustomMetadata = value => $(value).includes(G.CUSTOM_METADATA_PREFIX);

let isCustomLabel = value => $(value).startsWith(G.CUSTOM_LABEL_PREFIX);

let isCustomSetting = value => $(value).startsWith(G.CUSTOM_SETTING_PREFIX);

let isObjectType = value => $(value).startsWith(G.OBJECT_TYPE_PREFIX);

let isSpecialPrefix = value => G.SPECIAL_PREFIXES.includes($(value));

let isParentField = value => $(getField(value)) == G.SELF_REFERENTIAL_PARENT_FIELD;

let isParent = value => $(value) == G.SELF_REFERENTIAL_PARENT_OBJECT;

let isProcessBuilderPrefix = value => {
    return value.startsWith(G.PROCESS_BUILDER_BRACKET_START) && value.endsWith(G.PROCESS_BUILDER_BRACKET_END);
}

let isCPQRelationship = value => {

    let obj =  $(getObject(value));

    return obj.startsWith(G.CPQ_NAMESPACE) && obj.endsWith(G.RELATIONSHIP_SUFFIX);
}

let isOperator = char => {

    if(isNothing(char)) return false;
    return G.OPERATORS.includes(char.trim());
}

let isFunction = value => {
    
    if(isNothing(value)) return false;
    
    return G.FUNCTIONS.includes($(value.trim()));
};

module.exports = {isFunction,isOperator,
    isCustom,isInterestingOperator,isNothing,isNumber,
    isStandardRelationship,isParent,isCPQRelationship,isParentField,isProcessBuilderPrefix,
isUserField,isCustomMetadata,isCustomLabel,isObjectType,isCommentStart,isCommentEnd,
isCustomSetting,isRelationshipField,isSpecialPrefix}