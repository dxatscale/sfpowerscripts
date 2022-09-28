let utils = require('../../services/utils');
let {restAPI,metadataAPI} = require('sfdc-happy-api')();
let logError = require('../../services/logging');
let {findWorkflowRules,findWorkflowFieldUpdates} = require('../metadata-types/utils/workflows');
const strip = require('strip-comments');
const {getStandardFields} = require('sf-standard-field-dependency')


async function findReferences(connection,entryPoint,cache,options){

    let metadataUsingField = [];

    let restApi = restAPI(connection,logError);
    let mdapi = metadataAPI(connection,logError);

    let [object,field] = entryPoint.name.split('.');

    let metadataUsingObject = await queryDependeciesByObjectName(object);

    let metadataByType = new Map();

    metadataUsingObject.forEach(metadata => {

        if(metadataByType.get(metadata.type)){
            metadataByType.get(metadata.type).push(metadata);
        }
        else{
            metadataByType.set(metadata.type,[metadata]);
        }
    });

    for (let [metadataType, members] of metadataByType) {

        let params = {
            object,
            field,
            metadataType,
            members
        }

        let results = [];

        let codeBasedField = getCodeBasedField(metadataType);

        if(codeBasedField){

            params.codeBasedField = codeBasedField;

            try {

                results = await searchFieldInCode(params);
                metadataUsingField.push(...results);
            } catch (error) {
                params = sanitiseError(error,params);
                logError('Error while searching standard field in code',params);
            }

        }
        else{

            let searchFunction = getSearchFunction(metadataType);

            if(searchFunction){

                try {
                    results = await searchFunction(params);
                    metadataUsingField.push(...results);
                } catch (error) {
                    params = sanitiseError(error,params);
                    logError('Error while searching standard field in metadata',params);
                }
            }
        } 
    }

    try {

        let [object,field] = entryPoint.name.split('.');
        let workflowFieldUpdates = await findWorkflowFieldUpdates(connection,object,`${object}.${field}`);
        metadataUsingField.push(...workflowFieldUpdates);

    } catch (error) {
        logError('Error while finding workflow field updates',{entryPoint,error});
    }

    try {

        let workflowRules = await findWorkflowRules(connection,entryPoint,cache);
        metadataUsingField.push(...workflowRules);

        try {
            //if the field belongs to the case object, we also need to search for references in the
            //workflow rules associated to the EmailMessage object
            if(object.toLowerCase() == 'case'){

                let [object,field] = entryPoint.name.split('.');

                entryPoint.name = `EmailMessage.Case-${field}`;

                let emailMessageWorkflowRules = await findWorkflowRules(connection,entryPoint,cache);
                metadataUsingField.push(...emailMessageWorkflowRules);
            }
        } catch (error) {
            logError('Error while finding workflow rules for child object',{entryPoint,error});
        }

        
    } catch (error) {
        logError('Error while finding workflow field updates',{entryPoint,error});
    }

    try {
        let validationRules = await findValidationRules();
        metadataUsingField.push(...validationRules);
    } catch (error) {
        logError('Error while finding validation rules',{entryPoint,error});
    }


    return metadataUsingField;

    async function findValidationRules(){

        let query = `SELECT ValidationName, Id FROM ValidationRule WHERE EntityDefinitionId = '${object}'`;
        let soql = {query,filterById:false,useToolingApi:true};

        let rawResults = await restApi.query(soql);

        let idsByName = new Map();

        rawResults.records.forEach(record => {
            idsByName.set(`${object}.${record.ValidationName}`,record.Id);
        });


        //we do a metadata retrieve on the validation rules to inspect them and see if they
        //reference the field in question
        let validationRulesMetadata = await mdapi.readMetadata('ValidationRule',Array.from(idsByName.keys()));

    
        let validationsUsingField = [];

        validationRulesMetadata.forEach(vr => {

            try {
                //formulas can be strings or booleans so we need to make sure
                //we are checking against the correct type
                if(typeof vr.errorConditionFormula === 'string' || vr.errorConditionFormula instanceof String){
                    if(vr.errorConditionFormula.includes(field)){
                        validationsUsingField.push(vr.fullName);
                    }
                    else if(vr.errorDisplayField == field){
                        validationsUsingField.push(vr.fullName);
                    }
                }
            }catch (error) {
                logError('Error when processing validation rule',{vr,error});
            }
        })

        validationsUsingField = validationsUsingField.map(vrName => {

            let id = idsByName.get(vrName);

            let simplified = {
                name:vrName,
                type:'ValidationRule',
                id: id,
                url:`${connection.url}/${id}`,
                notes:null,       
            }
    
            return simplified;
        });

        return validationsUsingField;
    }

    
    async function queryDependeciesByObjectName(parentObjectName){

        let query = `SELECT MetadataComponentId, MetadataComponentName,MetadataComponentType,MetadataComponentNamespace, RefMetadataComponentName, RefMetadataComponentType, RefMetadataComponentId,
        RefMetadataComponentNamespace 
        FROM MetadataComponentDependency 
        WHERE RefMetadataComponentId  = '${parentObjectName}' ORDER BY MetadataComponentType`;

        let soqlQuery = {query,filterById:true,useToolingApi:true};
        let rawResults = await restApi.query(soqlQuery);   

        let callers = simplifyResults(rawResults);

        return callers;
    }

    function simplifyResults(rawResults){

        let callers = rawResults.records.map(caller => {
    
            let simplified = {
                name:caller.MetadataComponentName,
                type:caller.MetadataComponentType,
                id:caller.MetadataComponentId,
                url:`${connection.url}/${caller.MetadataComponentId}`,
                notes:null,
                namespace: caller.MetadataComponentNamespace,       
            }

            return simplified;          
        });

        return callers;
    }

    async function searchFieldInCode(params){

        let {field,codeBasedField,metadataType,members} = params;

        let fieldNameRegex = new RegExp(`${field}`,'gi');
    
        let ids = members.map(m => m.id);
        ids = utils.filterableId(ids);
    
        let query = `SELECT Id,Name,${codeBasedField},NamespacePrefix FROM ${metadataType} WHERE Id IN ('${ids}')`;
        let soqlQuery = {query,filterById:true,useToolingApi:true};
    
        let rawResults  = await restApi.query(soqlQuery);
    
        let metadataBodyById = new Map();
    
        rawResults.records.forEach(rec => {
            metadataBodyById.set(rec.Id,rec[codeBasedField]);
        });
        
        let metadataUsingField = [];
        let apexClassIds = [];
        
        members.map(async member => {
    
            let body = metadataBodyById.get(member.id);

            if(body){

                //remove comments to avoid false positives
                //try/catch because this being a 3rd party library
                //we don't know when it can throw errors
                //so if there's an error we just proceed
                //to read the class with its comments
                //which is better than throwing an error
                //to the user
                try {
                    body = strip(body);
                } catch (error) {
                    //move on
                }
                //remove all white space/new lines
                body = body.replace(/\s/g,'');
        
                if(body.match(fieldNameRegex)){

                    if(metadataType == 'ApexClass'){
                        apexClassIds.push(member.id);
                    }
                    //for non-apex classes, we assume that a match on the regex means that the field
                    //is being used
                    else{
                        metadataUsingField.push(member);
                    }         
                }
            }
        });

        metadataUsingField = metadataUsingField.map(m => {
    
            let simplified = {
                name:m.name,
                type:metadataType,
                id: m.id,
                url:`${connection.url}/${m.id}`,
                notes:null,      
            }
    
            return simplified;          
        });

        //for apex classes, we use the sf-standard-field-dependency module
        //but the recordType field is not yet supported, so we skip this completely
        // if(apexClassIds.length && field != 'RecordType'){

        //     apexClassIds = utils.filterableId(apexClassIds);
        //     let query = `SELECT Id, Name, SymbolTable, Body FROM ApexClass WHERE Id IN ('${apexClassIds}')`;
        //     let soqlQuery = {query,filterById:true,useToolingApi:true};

        //     let rawResults  = await restApi.query(soqlQuery);

        //     await Promise.all(

        //         rawResults.records.map(async record => {

        //             if(record.SymbolTable && record.Body){

        //                 let {SymbolTable,Body} = record;

        //                 const sfStandardFieldOptions = {
        //                     SymbolTable,
        //                     Body,
        //                     token:connection.token,
        //                     url:connection.url
        //                 };

        //                 try {

        //                     let fullFieldName = entryPoint.name;
                
        //                     //the owner field is represented as OwnerId in apex classes, but as Owner in other metadata types
        //                     //when we support additional standard relationship fields, we'll extract this logic into its own method
        //                     if(field == 'Owner'){
        //                         fullFieldName = `${object}.OwnerId`;
        //                     }

        //                     let mapResponse = await getStandardFields(sfStandardFieldOptions, {fields: [fullFieldName]});

        //                     if(mapResponse instanceof Map){

        //                         let isUsed = mapResponse.get(fullFieldName);
        
        //                         if(isUsed){
    
        //                             let simplified = {
        //                                 name:record.Name,
        //                                 type:'ApexClass',
        //                                 id:record.Id,
        //                                 url:`${connection.url}/${record.Id}`
        //                             }
    
        //                             metadataUsingField.push(simplified);
        //                         }
        //                     }
       
        //                 } catch (error) {
        //                     //nothing to do because this is a best effort functionality
        //                 }
        //             }
        //         })
        //     )
        // }

        return metadataUsingField;
    }

    async function searchFieldInEmailTemplate(params){

        let {field,members} = params;

        let fieldNameRegex = new RegExp(`${field}`,'gi');

        const EMAIL_TEMPLATE_QUERY_LIMIT = 50;
        let ids = [];

        //we query a max number of templates to avoid too many API calls
        for (let index = 0; index < EMAIL_TEMPLATE_QUERY_LIMIT; index++) {
            if(members[index]){
                ids.push(members[index].id);
            }  
        }

        let idsByName = new Map();

        let fullNames = await Promise.all(

            ids.map(async (id) => {

                let query = `SELECT FullName,Name,NamespacePrefix,Id FROM EmailTemplate WHERE Id = '${id}' `;
                let soqlQuery = {query,useToolingApi:true};
    
                let rawResults = await restApi.query(soqlQuery);
                let template = rawResults.records[0];

                idsByName.set(template.Name,template.Id);
            
                return template.FullName;
            })
        );


        let readMetadataResult = await mdapi.readMetadata('EmailTemplate',fullNames);

        let templatesUsingField = [];

        readMetadataResult.forEach(template => {

            let buff = new Buffer(template.content, 'base64');
            let templateContent = buff.toString('ascii');

            //remove all white space/new lines  
            templateContent = templateContent.replace(/\s/g,'');
            
            if(templateContent.match(fieldNameRegex)){
                
                let templateId = idsByName.get(template.name);

                let simplified = {
                    name:template.name,
                    type:'EmailTemplate',
                    id: templateId,
                    url:`${connection.url}/${templateId}`,
                    notes:null,      
                }

                templatesUsingField.push(simplified);
            }
       });

       return templatesUsingField;
    }

    function getSearchFunction(metadataType){

        let searchFunctionByMetadataType = new Map();
        searchFunctionByMetadataType.set('EmailTemplate',searchFieldInEmailTemplate);

        return searchFunctionByMetadataType.get(metadataType);
    
    }

}

function sanitiseError(error,params){
    params.error = error;
    //we dont want to log the members because they contain org-specific information
    params.members = null;
    return params;
}

function getCodeBasedField(metadataType){

    let codeBasedFieldByMetadataType = new Map();
    codeBasedFieldByMetadataType.set('ApexClass','Body');
    codeBasedFieldByMetadataType.set('ApexTrigger','Body');
    codeBasedFieldByMetadataType.set('ApexPage','Markup');

    return codeBasedFieldByMetadataType.get(metadataType);
}

module.exports = findReferences;