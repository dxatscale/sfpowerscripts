let {restAPI,metadataAPI} = require('sfdc-happy-api')();
let logError = require('../../../services/logging');

/**
* field updates tied to a specific field can be found
* by looking at the FieldDefinitionId field which comes in
* the following format FieldDefinitionId  = '01I3h000000ewd0.00N3h00000DAO0J'
* The first id is the EntityId of the object that the field is linked to
* for standard objects, this would be 'Account.00N3h00000DAO0J'
* the 2nd id is the 15 digit version of the custom field id*/
async function findWorkflowFieldUpdates(connection,objectName,fieldDefinitionId){

    let query = `SELECT Id,name FROM WorkflowFieldUpdate WHERE FieldDefinitionId = '${fieldDefinitionId}'`;
    let soql = {query,useToolingApi:true};

    let restApi = restAPI(connection,logError);

    let rawResults = await restApi.query(soql);

    let fieldUpdates = rawResults.records.map(fieldUpdate => {

        //we guess the API name by replacing spaces with underscores
        //to get the real API name we'd have to query each field update
        //1 by 1 and it's not really worth it
        let apiName = fieldUpdate.Name.replace(/ /g,"_");

        let simplified = {
            name:`${objectName}.${apiName}`,
            type:'WorkflowFieldUpdate',
            id: fieldUpdate.Id,
            url:`${connection.url}/${fieldUpdate.Id}`,
            notes:null,       
        }

        return simplified;
    });

    return fieldUpdates;

}

async function findWorkflowRules(connection,entryPoint,cache){

    let restApi = restAPI(connection,logError);
    let mdapi = metadataAPI(connection,logError);

    //the entryPoint name is the full API name i.e Case.My_Custom_Field__c
    //here we split it and get the 2 parts
    let [objectName,fieldName] = entryPoint.name.split('.');

    //if the fieldName contains a -, this means that the field is actually from a parent object,
    //so we need to replace the - with a .
    //For example, we may try to find the Case.Status field in the EmailMessage object, in that case
    //the entry point will be EmailMessage.Case-Status

    let searchParentOnFormulas = false;

    if(fieldName.includes('-')){
        let [parent,field] = fieldName.split('-');
        entryPoint.name = `${parent}.${field}`
        searchParentOnFormulas = true;
    }
    
    let workflowRuleMetadata = [];
    let idsByWorkflowName = new Map();

    if(cache.getWorkflowRules(objectName)){

        let cachedData = cache.getWorkflowRules(objectName);
        workflowRuleMetadata = cachedData.cachedWorkflows;
        let mappedData = cachedData.mappedData;

        mappedData.forEach(data => {
            let [fullName,Id] = data.split(':');
            idsByWorkflowName.set(fullName,Id);
        });
    }
    else{

        let query = `SELECT name, Id FROM WorkflowRule WHERE TableEnumOrId = '${objectName}'`;
        let soql = {query,filterById:false,useToolingApi:true};

        let rawResults = await restApi.query(soql);

        //maps cannot be cached on redis so we create a mirror
        //of the below map in array format so that we can cache it
        let mappedData = [];

        rawResults.records.forEach(record => {

            //workflow rule names allow for following characters < > &, which must be escapted to valid XML before we read
            //the metadata using the metadata API, as it is XML-based
            let escapedName = record.Name.replace(/&/g,"&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

            let fullWfName = `${objectName}.${escapedName}`;
            idsByWorkflowName.set(fullWfName,record.Id);
            mappedData.push(`${fullWfName}:${record.Id}`);

        });

        //we do a metadata retrieve on the workflow rules to inspect them and see if they
        //reference the field in question
        workflowRuleMetadata = await mdapi.readMetadata('WorkflowRule',Array.from(idsByWorkflowName.keys()));

        //we don't need to store all the data in the cache
        //so we simplify the object
        //this reducdes redis storage needs
        let cachedWorkflows = workflowRuleMetadata.map(wf => {

            let details = {
                fullName:wf.fullName,
            };

            if(wf.formula){
                details.formula = wf.formula;
            }
            else if(wf.criteriaItems){
                details.criteriaItems = wf.criteriaItems;
            }

            return details;

        });

        let cacheData = {cachedWorkflows,mappedData};
        cache.cacheWorkflowRules(objectName,cacheData);
    }


    let wfsUsingField = [];

    workflowRuleMetadata.forEach(wf => {

        let workflow = {};
        workflow.pills = [];

        workflow.name = wf.fullName;

        if(wf.active){

            workflow.pills.push({
                label:`Active`,
                type:'success',
                description:'The workflow is activated'
            });
        }
        else{
            workflow.pills.push({
                label:`Deactivated`,
                type:'standard',
                description:'The workflow is deactivated'
            });
        }

        workflow.pills.push({
            label:`Type: ${wf.triggerType}`,
            type:'standard',
            description:'Under what conditions the workflow fires'
        });

        

        try {

            if(wf.formula){
                //formulas can be strings or booleans so we need to make sure
                //we are checking against the correct type
                if(typeof wf.formula === 'string' || wf.formula instanceof String){

                    if(wf.formula.includes(fieldName)){
                        wfsUsingField.push(workflow);
                    }
                    if(searchParentOnFormulas){
                        let formulaFieldName = 'Parent.'+fieldName.split('-')[1];
                        if(wf.formula.includes(formulaFieldName)){
                            wfsUsingField.push(workflow);
                        }
                    }
                }
            }
        
            if(wf.criteriaItems){

                if(Array.isArray(wf.criteriaItems)){
                    wf.criteriaItems.forEach(criteria => {
                        if(criteria.field == entryPoint.name){
                            wfsUsingField.push(workflow);
                        }
                    });
                }
                else{
                    if(wf.criteriaItems.field == entryPoint.name){
                        wfsUsingField.push(workflow);
                    }
                }                
            }
        } catch (error) {
            logError('Error when processing workflow rule',{wf,error});
        }

        
    });

    wfsUsingField = wfsUsingField.map(wf => {

        let workflowId = idsByWorkflowName.get(wf.name);

        let simplified = {
            name:wf.name,
            type:'WorkflowRule',
            id: workflowId,
            url:`${connection.url}/${workflowId}`,
            notes:null,    
            pills:wf.pills   
        }

        return simplified;
    });

    return wfsUsingField;
}   

module.exports = {findWorkflowFieldUpdates,findWorkflowRules}