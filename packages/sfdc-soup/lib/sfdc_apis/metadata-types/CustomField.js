/**
 * This module is for finding references to custom fields that are not (at the time of this writing) supported
 * by the MetadataComponentDependency object. In other words, these are references that we find manually by
 * matching the field id in other metadata types. 
 */

let {restAPI,metadataAPI} = require('sfdc-happy-api')(); 
const logError = require('../../services/logging');
let utils = require('../../services/utils');
let {findWorkflowRules,findWorkflowFieldUpdates} = require('../metadata-types/utils/workflows');



async function findReferences(connection,entryPoint,cache,options){

    let references = [];
    let restApi = restAPI(connection,logError);
    let mdapi = metadataAPI(connection,logError);
    let [object,field] = entryPoint.name.split('.');

    let workflowRules = [];
    let workflowFieldUpdates = [];
    let metadataTypeRecords = [];
    let congaQueries = [];
    let flexiPages = [];

    let edf = await getEntityDefinitionFormat(restApi,entryPoint.id);

    try {
        workflowRules = await findWorkflowRules(connection,entryPoint,cache);

        try {

            //if the field belongs to the case object, we also need to search for references in the
            //workflow rules associated to the EmailMessage object
            if(object.toLowerCase() == 'case'){

                entryPoint.name = `EmailMessage.Case-${field}`;

                let emailMessageWorkflowRules = await findWorkflowRules(connection,entryPoint,cache);
                workflowRules.push(...emailMessageWorkflowRules);
            }
        } catch (error) {
            logError('Error while finding workflow rules for child object',{entryPoint,error});
        }


    } catch (error) {
        logError('Error while finding workflow rules',{entryPoint,error});
    }

    try {  
        workflowFieldUpdates = await findWorkflowFieldUpdates(connection,object,`${edf.entityDefinitionId}.${edf.shortFieldId}`);
    } catch (error) {
        logError('Error while finding workflow field updates',{entryPoint,error});
    }

    try {
        metadataTypeRecords = await findMetadataTypeRecords();
    } catch (error) {
        logError('Error while finding metadata type records',{entryPoint,error});
    }

    try {
        congaQueries = await findCongaQueries();
    } catch (error) {
        //if this throws an error is likely because the org doesn't have Conga installed, so there's
        //no need to log this
    }

    try {
        flexiPages = await findFlexiPages();
    } catch (error) {
        //if this throws an error is likely because the org doesn't have Conga installed, so there's
        //no need to log this
    }

    references.push(
        ...workflowRules,
        ...workflowFieldUpdates,
        ...metadataTypeRecords,
        ...congaQueries,
        ...flexiPages
    );

    return references;

    /**
     * Custom Metadata Types can reference custom fields using a special field type known as FieldDefinition lookup.
     * Here we try to manually find those references by finding which objects are metadata types and then
     * querying some of their fields to see if any of them match on the field id.
     */
    async function findMetadataTypeRecords(){

        let metadataTypesUsingField = [];
        if(!options.fieldInMetadataTypes) return metadataTypesUsingField;

        let mdTypeUtils = require('../metadata-types/utils/CustomMetadataTypes');

        let metadataTypeCustomFields = await mdTypeUtils.getCustomMetadataTypeFields(connection);

        if(!metadataTypeCustomFields.length) return metadataTypesUsingField;

        //we need to do a metadata retrieve of all these custom fields so that we can inspect them
        //and see which ones are of the type FieldDefinition
        let customFieldsMetadata = await mdapi.readMetadata('CustomField',metadataTypeCustomFields);

        let fieldDefinitionFields = [];

        customFieldsMetadata.forEach(fieldMd => {
            if(fieldMd.referenceTo && fieldMd.referenceTo == 'FieldDefinition'){
                fieldDefinitionFields.push(fieldMd.fullName);
            }
        });

        if(!fieldDefinitionFields.length) return metadataTypesUsingField;

        //field definition fields hold the value of a custom field using this special format
        let searchValue = `${edf.entityDefinitionId}.${edf.shortFieldId}`;

        metadataTypesUsingField = await mdTypeUtils.queryMetadataTypeForValue(connection,fieldDefinitionFields,searchValue);

        return metadataTypesUsingField;
    }

    async function findFlexiPages(){

        let flexiPagesUsingField = [];

        let query = `SELECT Id FROM FlexiPage WHERE EntityDefinitionId = '${edf.entityDefinitionId}'`
        let soql = {query,filterById:false,useToolingApi:true};

        let rawResults = await restApi.query(soql);

        let flexiPages = rawResults.records.map(record => {

            return {
                id:record.Id,
                type:'FlexiPage'
            }
        });

        let metadataByType = await restApi.readMetadata(flexiPages);

        metadataByType.forEach((members,type) => {

            members.forEach(flexiPage => {

                let {Metadata} = flexiPage;

                Metadata.flexiPageRegions.forEach(region => {

                    region.itemInstances.forEach(ii => {

                        if(ii.componentInstance.visibilityRule && ii.componentInstance.visibilityRule.criteria){

                            let criterias = ii.componentInstance.visibilityRule.criteria;

                            criterias.forEach(criteria => {

                                if(criteria.leftValue.includes(field)){

                                    let simplified = {
                                        name: flexiPage.DeveloperName,
                                        id: flexiPage.Id,
                                        type:'FlexiPage',
                                        url:`${connection.url}/${flexiPage.Id}`,
                                        pills:[
                                            {
                                                label:`Filter: ${criteria.operator} ${criteria.rightValue}`,
                                                type:'standard',
                                                description:'The filter used in the FlexiPage'
                                            },
                                            {
                                                label:`${flexiPage.Type}`,
                                                type:'standard',
                                                description:'The FlexiPage type'
                                            }
                                        ]
                                    }
    
                                    flexiPagesUsingField.push(simplified);
    
                                }
                            })
                        }
                    })
                })
            })

        })

        return flexiPagesUsingField;
        
    }

    async function findCongaQueries(){

        let queriesUsingField = [];
        if(!options.searchCongaQueries) return metadataTypesUsingField;

        let query = `SELECT Id,Name,APXTConga4__Name__c ,APXTConga4__Query__c FROM APXTConga4__Conga_Merge_Query__c`;
        let rawResults = await restApi.query({query});
  
        rawResults.records.forEach(record => {

            if(record.APXTConga4__Query__c != null){

                let congaQuery = record.APXTConga4__Query__c.toLowerCase();
        
                let lcObject = object.toLowerCase();
                let lcField = field.toLowerCase();

                if(congaQuery.includes(lcObject) && congaQuery.includes(lcField)){

                    let queryName = record.APXTConga4__Name__c ? record.APXTConga4__Name__c : record.Name;

                    let simplified = {
                        name: queryName,
                        id: record.Id,
                        type:'APXTConga4__Conga_Merge_Query__c',
                        url:`${connection.url}/${record.Id}`,
                        pills:[
                            {
                                label:`See query`,
                                type:'standard',
                                description:congaQuery
                            }
                        ]
                    }
                    queriesUsingField.push(simplified);
                } 
            }
        })

        return queriesUsingField;

    }

}

/**
 * Most of the references to custom fields use this special format
 * where Account.My_Field__c is translated to Account.0345000345465 (15 digit id)
 * or My_Object__c.my_Field__c to 00554567576.24565766477 (object and field id)
 * 
 * So here we pass the field id and get an object that has both the object id
 * and the short field id. Subsequent API calls within this module will use
 * any of these 2 values as needed.
 */
async function getEntityDefinitionFormat(restApi,id){

    let fieldId = utils.filterableId(id);
    let query = `SELECT EntityDefinitionId FROM CustomField WHERE Id IN ('${fieldId}')`;
    let soql = {query,filterById:true,useToolingApi:true};

    let rawResults = await restApi.query(soql);

    let entityDefinitionId = rawResults.records[0].EntityDefinitionId;
    let shortFieldId = id.substring(0,15);

    return {entityDefinitionId,shortFieldId}
}


module.exports = findReferences;