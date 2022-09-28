let _ = require('./utils');
let check = require('./parser/grammarChecks');
let transform = require('./parser/transformations');

function parseType(value,originalObject){

    let types = []

    //this order matters, we have to evaluate object types before anything else because the syntax can be extremely similar to other types

    if(check.isObjectType(value)){
        types.push(...transform.parseObjectType(value))
    }
   
    else if(check.isCustomMetadata(value)){
        types.push(...transform.parseCustomMetadata(value))
    }

    else if(check.isCustomLabel(value)){
        types.push(transform.parseCustomLabel(value));
    }

    else if(check.isCustomSetting(value)){
        types.push(...transform.parseCustomSetting(value))
    }
   
    else if(check.isRelationshipField(value)){

        let lastKnownParent = '';

        _.parts(value).forEach((field,index,fields) => {

            if(check.isSpecialPrefix(field) || check.isProcessBuilderPrefix(field)) return;
            
            let baseObject = '';
            let isLastField = (fields.length-1 == index);

            if(index == 0){
                baseObject = originalObject;
            }
            else{

                baseObject = fields[index-1];

                if(check.isProcessBuilderPrefix(baseObject)){
                    baseObject = transform.removeFirstAndLastChars(baseObject);
                }
            }

            if(check.isParent(baseObject) && lastKnownParent != ''){
                baseObject = lastKnownParent;
            }

            fieldName = transform.createApiName(baseObject,field);
          
            if(!isLastField){

                if(check.isStandardRelationship(fieldName)){
                    fieldName = transform.transformToId(fieldName);
                }
                else{
                    fieldName = transform.replaceRwithC(fieldName);
                }
            }

            if(check.isCPQRelationship(fieldName)){
                fieldName = transform.mapCPQField(fieldName,originalObject)
            }

            if(check.isUserField(fieldName)){
                fieldName = transform.transformToUserField(fieldName)
            }

            if(check.isParentField(fieldName) && lastKnownParent == ''){
                lastKnownParent = baseObject;
            }

            else if(check.isParentField(fieldName) && lastKnownParent != ''){
                fieldName = transform.createApiName(lastKnownParent,_.getField(fieldName));
            }
            
            parseField(fieldName,originalObject);
        });
    }

    else{      
        parseField(value,originalObject);
    }

    function parseField(field,object){

        field = transform.removePrefix(field);

        //i.e Account.Industry
        if(_.parts(field).length == 2){

            types.push(transform.parseField(field));
            types.push(transform.parseObject(_.getObject(field)));
        }
        else{
            //i.e Name
            types.push(transform.parseField(transform.createApiName(object,field)));
            types.push(transform.parseObject(object));
        }
    }
    
    return types;

}

module.exports = parseType;